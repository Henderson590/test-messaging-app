import { useEffect, useState } from "react";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  updateDoc,
  arrayUnion,
  arrayRemove,
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import "./ChatListPage.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Chat from "../components/Chat";
import CameraPanel from "../components/CameraPanel";

function ChatListPage() {
  const navigate = useNavigate();

  // ----- Friends & chat -----
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [showChatPanel, setShowChatPanel] = useState(false);

  // ----- Panels -----
  const [showRequests, setShowRequests] = useState(false);
  const [showAddFriends, setShowAddFriends] = useState(false);

  // ----- Requests -----
  const [requests, setRequests] = useState([]);

  // ----- Add-Friends search -----
  const [searchName, setSearchName] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchMessage, setSearchMessage] = useState("");

  // ----- Current User Data -----
  const [currentUserData, setCurrentUserData] = useState(null);

  // ───────────────────────────────
  // Load current user Firestore data
  useEffect(() => {
    const fetchCurrentUser = async () => {
      if (!auth.currentUser) return;

      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        setCurrentUserData({ uid: auth.currentUser.uid, ...userDoc.data() });
      }
    };

    fetchCurrentUser();
  }, []);

  // ───────────────────────────────
  // Load friends and sync nicknames from current user's nicknames object
  useEffect(() => {
    if (!auth.currentUser) return;
    let unsubUser = null;
    let unsubNicknames = null;
    let isMounted = true;

    const updateFriendsList = async (friendUIDs, nicknamesObj) => {
      const friendsData = await Promise.all(friendUIDs.map(async (uid) => {
        const friendDoc = await getDoc(doc(db, "users", uid));
        let nickname = nicknamesObj && nicknamesObj[uid] ? nicknamesObj[uid] : undefined;
        return friendDoc.exists()
          ? { uid, ...friendDoc.data(), nickname }
          : { uid, username: "Unknown user", nickname };
      }));
      if (isMounted) setFriends(friendsData);
    };

    unsubUser = onSnapshot(doc(db, "users", auth.currentUser.uid), (userSnap) => {
      if (userSnap.exists()) {
        const data = userSnap.data();
        const friendUIDs = data.friends || [];
        const nicknamesObj = data.nicknames || {};
        updateFriendsList(friendUIDs, nicknamesObj);
      }
    });

    // Real-time listener for nickname changes
    unsubNicknames = onSnapshot(doc(db, "users", auth.currentUser.uid), (userSnap) => {
      if (userSnap.exists()) {
        const data = userSnap.data();
        const friendUIDs = data.friends || [];
        const nicknamesObj = data.nicknames || {};
        updateFriendsList(friendUIDs, nicknamesObj);
      }
    });

    return () => {
      isMounted = false;
      if (unsubUser) unsubUser();
      if (unsubNicknames) unsubNicknames();
    };
  }, []);

  // ───────────────────────────────
  // Real-time friend requests listener
  useEffect(() => {
    if (!auth.currentUser) return;

    const userRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        setRequests(docSnap.data().pendingRequests || []);
      }
    });

    return () => unsubscribe();
  }, []);

  // ───────────────────────────────
  // Handlers
  const handleLogout = async () => {
    try {
      await signOut(auth);

      toast.info("Logged out successfully!", {
        position: "top-center",
        autoClose: 2000,
      });

      setTimeout(() => {
        navigate("/");
      }, 2000);
    } catch (error) {
      console.error("Error logging out:", error);
      toast.error("Failed to log out", { position: "top-center" });
    }
  };

  const openChat = (friend) => {
    setSelectedFriend(friend);
    setShowChatPanel(true);
  };

  const closeChat = () => {
    setShowChatPanel(false);
    setSelectedFriend(null);
  };

  // ───────────────────────────────
  // Add-Friends search logic
  const handleSearch = async () => {
    if (!searchName.trim()) return;
    setSearchMessage("");
    try {
      const q = query(collection(db, "users"), where("username", "==", searchName));
      const querySnap = await getDocs(q);

      if (!querySnap.empty) {
        const userDoc = querySnap.docs[0];
        setSearchResult({ uid: userDoc.id, ...userDoc.data() });
      } else {
        setSearchResult(null);
        setSearchMessage("No user found");
      }
    } catch (err) {
      console.error(err);
      setSearchMessage("Error searching user");
    }
  };

  const sendFriendRequest = async () => {
    if (!searchResult) return;
    const currentUser = auth.currentUser;

    try {
      const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
      const currentUsername = currentUserDoc.exists()
        ? currentUserDoc.data().username
        : currentUser.email;

      const recipientRef = doc(db, "users", searchResult.uid);
      await updateDoc(recipientRef, {
        pendingRequests: arrayUnion({
          fromUid: currentUser.uid,
          fromUsername: currentUsername,
        }),
      });

      setSearchMessage("Friend request sent!");
      setSearchResult(null);
      setSearchName("");
    } catch (err) {
      console.error(err);
      setSearchMessage("Failed to send request");
    }
  };

  // ───────────────────────────────
  // Accept / deny requests
  const acceptRequest = async (req) => {
    const currentUid = auth.currentUser.uid;
    const currentRef = doc(db, "users", currentUid);
    const friendRef = doc(db, "users", req.fromUid);

    try {
      await updateDoc(currentRef, {
        friends: arrayUnion(req.fromUid),
        pendingRequests: arrayRemove(req),
      });

      await updateDoc(friendRef, {
        friends: arrayUnion(currentUid),
      });

      setRequests((prev) => prev.filter((r) => r.fromUid !== req.fromUid));
      setFriends((prev) => [...prev, { uid: req.fromUid, username: req.fromUsername }]);

      toast.success("Friend Request Accepted!", {
        position: "top-center",
        autoClose: 2000,
      });
    } catch (err) {
      console.error("Error accepting request:", err);
      toast.error("Failed to accept request. Please try again.", {
        position: "top-center",
      });
    }
  };

  const denyRequest = async (req) => {
    const currentRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(currentRef, {
      pendingRequests: arrayRemove(req),
    });
    setRequests((prev) => prev.filter((r) => r.fromUid !== req.fromUid));
  };

  // ───────────────────────────────
  return (
    <div className="chat-list-page" style={{ display: 'flex', flexDirection: 'row', minHeight: '100vh' }}>
      <div style={{ flex: 1 }}>
        <header className="header">
          <div className="header-left">
            <button
              className="requests-btn"
              onClick={() => setShowRequests(true)}
            >
              Requests ({requests.length})
            </button>
            <button
              className="add-friends-btn"
              onClick={() => setShowAddFriends(true)}
            >
              Add Friends
            </button>
          </div>

          <div className="header-right">
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </header>

        <h2 style={{ textAlign: 'left', marginLeft: 32 }}>Friends</h2>
        <div className="friends-container">
          {friends.length > 0 ? (
            friends.map((friend) => (
              <div
                key={friend.uid}
                className="friend-box"
                onClick={() => openChat(friend)}
              >
                {friend.nickname || friend.username || "Unknown user"}
              </div>
            ))
          ) : (
            <p>No friends yet</p>
          )}
        </div>

        {/* Slide-in Chat Panel */}
        {showChatPanel && selectedFriend && currentUserData && (
          <div className={`chat-panel ${showChatPanel ? "open" : ""}`}>
            <Chat
              friend={selectedFriend}
              currentUser={currentUserData}
              onClose={closeChat}
            />
          </div>
        )}

        {/* Friend-Requests Panel */}
        {showRequests && (
          <div className="requests-panel">
            <button className="close-btn top-left" onClick={() => setShowRequests(false)}>✕</button>
            <h2>Friend Requests</h2>
            {requests.length ? (
              requests.map((req) => (
                <div key={req.fromUid} className="request-item">
                  <span>{req.fromUsername}</span>
                  <div>
                    <button onClick={() => acceptRequest(req)}>Accept</button>
                    <button onClick={() => denyRequest(req)}>Deny</button>
                  </div>
                </div>
              ))
            ) : (
              <p>No pending requests</p>
            )}
          </div>
        )}

        {/* Add-Friends Panel */}
        {showAddFriends && (
          <div className="add-friends-panel">
            <button className="close-btn top-left" onClick={() => setShowAddFriends(false)}>✕</button>
            <h2>Add Friends</h2>
            <div className="search-bar-container">
              <input
                type="text"
                placeholder="Enter username"
                value={searchName}
                onChange={(e) => setSearchName(e.target.value)}
              />
              <button onClick={handleSearch}>Search for Friend</button>
            </div>
            {searchResult && (
              <div className="search-result">
                <span>{searchResult.username}</span>
                <button onClick={sendFriendRequest}>+ Add Friend</button>
              </div>
            )}
            {searchMessage && <p>{searchMessage}</p>}
          </div>
        )}

        {/* Toast container */}
        <ToastContainer />
      </div>
      {/* Camera input panel on right side */}
      <CameraPanel />
    </div>
  );
}

export default ChatListPage;
