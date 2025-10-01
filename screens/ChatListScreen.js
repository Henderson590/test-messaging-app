// screens/ChatListScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Modal, TextInput, StyleSheet, ScrollView } from "react-native";
import { auth, db } from "../firebase";
import { signOut } from "firebase/auth";
import { doc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
import Toast from "react-native-toast-message";
import ChatScreen from "./ChatScreen"; // Assuming you have a separate ChatScreen component
import CameraPanel from "../components/CameraPanel"; // RN version

export default function ChatListScreen() {
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [requests, setRequests] = useState([]);
  const [showRequests, setShowRequests] = useState(false);
  const [showAddFriends, setShowAddFriends] = useState(false);
  const [searchName, setSearchName] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [searchMessage, setSearchMessage] = useState("");
  const [currentUserData, setCurrentUserData] = useState(null);

  // Load current user data
  useEffect(() => {
    if (!auth.currentUser) return;
    const fetchUser = async () => {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) setCurrentUserData({ uid: auth.currentUser.uid, ...userDoc.data() });
    };
    fetchUser();
  }, []);

  // Load friends & nicknames
  useEffect(() => {
    if (!auth.currentUser) return;
    let isMounted = true;

    const updateFriends = async (friendUIDs, nicknames) => {
      const friendsData = await Promise.all(friendUIDs.map(async uid => {
        const docSnap = await getDoc(doc(db, "users", uid));
        const nickname = nicknames && nicknames[uid] ? nicknames[uid] : undefined;
        return docSnap.exists() ? { uid, ...docSnap.data(), nickname } : { uid, username: "Unknown", nickname };
      }));
      if (isMounted) setFriends(friendsData);
    };

    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), docSnap => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        updateFriends(data.friends || [], data.nicknames || {});
      }
    });

    return () => { isMounted = false; unsub(); };
  }, []);

  // Friend requests listener
  useEffect(() => {
    if (!auth.currentUser) return;
    const unsub = onSnapshot(doc(db, "users", auth.currentUser.uid), docSnap => {
      if (docSnap.exists()) setRequests(docSnap.data().pendingRequests || []);
    });
    return () => unsub();
  }, []);

  // Handlers
  const handleLogout = async () => {
    await signOut(auth);
    Toast.show({ type: "info", text1: "Logged out successfully!" });
  };

  const openChat = (friend) => setSelectedFriend(friend);

  const acceptRequest = async (req) => {
    const currentUid = auth.currentUser.uid;
    try {
      await updateDoc(doc(db, "users", currentUid), {
        friends: arrayUnion(req.fromUid),
        pendingRequests: arrayRemove(req),
      });
      await updateDoc(doc(db, "users", req.fromUid), {
        friends: arrayUnion(currentUid),
      });
      Toast.show({ type: "success", text1: "Friend request accepted!" });
    } catch (err) {
      console.error(err);
      Toast.show({ type: "error", text1: "Failed to accept request" });
    }
  };

  const denyRequest = async (req) => {
    await updateDoc(doc(db, "users", auth.currentUser.uid), {
      pendingRequests: arrayRemove(req),
    });
  };

  const handleSearch = async () => {
    if (!searchName.trim()) return;
    setSearchMessage("");
    const q = query(collection(db, "users"), where("username", "==", searchName));
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const userDoc = querySnap.docs[0];
      setSearchResult({ uid: userDoc.id, ...userDoc.data() });
    } else {
      setSearchResult(null);
      setSearchMessage("No user found");
    }
  };

  const sendFriendRequest = async () => {
    if (!searchResult) return;
    const currentUser = auth.currentUser;
    const currentUserDoc = await getDoc(doc(db, "users", currentUser.uid));
    const currentUsername = currentUserDoc.exists() ? currentUserDoc.data().username : currentUser.email;
    await updateDoc(doc(db, "users", searchResult.uid), {
      pendingRequests: arrayUnion({ fromUid: currentUser.uid, fromUsername: currentUsername }),
    });
    setSearchMessage("Friend request sent!");
    setSearchResult(null);
    setSearchName("");
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => setShowRequests(true)} style={styles.headerButton}>
          <Text>Requests ({requests.length})</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowAddFriends(true)} style={styles.headerButton}>
          <Text>Add Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleLogout} style={styles.headerButton}>
          <Text>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Friends List */}
      <FlatList
        data={friends}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.friendBox} onPress={() => openChat(item)}>
            <Text>{item.nickname || item.username}</Text>
          </TouchableOpacity>
        )}
      />

      {/* Chat Modal */}
      <Modal visible={!!selectedFriend} animationType="slide">
        <ChatScreen friend={selectedFriend} currentUser={currentUserData} onClose={() => setSelectedFriend(null)} />
      </Modal>

      {/* Requests Modal */}
      <Modal visible={showRequests} animationType="slide">
        <ScrollView style={styles.panel}>
          <TouchableOpacity onPress={() => setShowRequests(false)}><Text style={styles.close}>Close</Text></TouchableOpacity>
          <Text style={styles.panelTitle}>Friend Requests</Text>
          {requests.length ? requests.map((req) => (
            <View key={req.fromUid} style={styles.requestItem}>
              <Text>{req.fromUsername}</Text>
              <View style={styles.requestButtons}>
                <TouchableOpacity onPress={() => acceptRequest(req)}><Text>Accept</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => denyRequest(req)}><Text>Deny</Text></TouchableOpacity>
              </View>
            </View>
          )) : <Text>No pending requests</Text>}
        </ScrollView>
      </Modal>

      {/* Add Friends Modal */}
      <Modal visible={showAddFriends} animationType="slide">
        <View style={styles.panel}>
          <TouchableOpacity onPress={() => setShowAddFriends(false)}><Text style={styles.close}>Close</Text></TouchableOpacity>
          <Text style={styles.panelTitle}>Add Friends</Text>
          <TextInput
            placeholder="Enter username"
            value={searchName}
            onChangeText={setSearchName}
            style={styles.input}
          />
          <TouchableOpacity onPress={handleSearch} style={styles.searchButton}><Text>Search</Text></TouchableOpacity>
          {searchResult && (
            <View style={styles.searchResult}>
              <Text>{searchResult.username}</Text>
              <TouchableOpacity onPress={sendFriendRequest}><Text>+ Add Friend</Text></TouchableOpacity>
            </View>
          )}
          {searchMessage ? <Text>{searchMessage}</Text> : null}
        </View>
      </Modal>

      {/* Camera Panel */}
      <CameraPanel />
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  header: { flexDirection: "row", justifyContent: "space-around", padding: 16, backgroundColor: "#e0f7fa" },
  headerButton: { padding: 8, backgroundColor: "#b6eaff", borderRadius: 8 },
  friendBox: { padding: 16, margin: 8, backgroundColor: "#fff", borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
  panel: { flex: 1, padding: 16, backgroundColor: "#fff" },
  close: { fontSize: 18, color: "red", marginBottom: 12 },
  panelTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 16 },
  requestItem: { marginBottom: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  requestButtons: { flexDirection: "row", gap: 12 },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12, marginBottom: 12 },
  searchButton: { backgroundColor: "#0078d4", padding: 12, borderRadius: 8, alignItems: "center" },
  searchResult: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }
});
