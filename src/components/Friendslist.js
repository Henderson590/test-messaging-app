import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase";
import { collection, query, where, getDocs, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

export default function FriendsList() {
  const [users, setUsers] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchUsers = async () => {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("uid", "!=", auth.currentUser.uid)); // exclude yourself
      const snapshot = await getDocs(usersRef);
      const userList = snapshot.docs
        .map(doc => ({ uid: doc.id, ...doc.data() }))
        .filter(u => u.uid !== auth.currentUser.uid);
      setUsers(userList);
    };

    fetchUsers();
  }, []);

  // Function to get or create a chat between current user and selected friend
  const handleStartChat = async (friendUid) => {
    const chatsRef = collection(db, "chats");

    // Step 1: check if chat already exists
    const q = query(chatsRef); // we will filter manually
    const snapshot = await getDocs(q);
    let chat = null;
    snapshot.forEach(doc => {
      const data = doc.data();
      if (
        data.participants.includes(auth.currentUser.uid) &&
        data.participants.includes(friendUid)
      ) {
        chat = { id: doc.id, ...data };
      }
    });

    // Step 2: if no chat exists, create one
    if (!chat) {
      const docRef = await addDoc(chatsRef, { participants: [auth.currentUser.uid, friendUid] });
      chat = { id: docRef.id, participants: [auth.currentUser.uid, friendUid] };
    }

    // Step 3: navigate to chat page
    navigate(`/chat/${chat.id}`);
  };

  return (
    <div style={{ maxWidth: '400px', margin: '20px auto', textAlign: 'center' }}>
      <h2>Friends List</h2>
      {users.length === 0 && <p>No other users found.</p>}
      {users.map(user => (
        <div
          key={user.uid}
          style={{ border: '1px solid #ccc', padding: '10px', margin: '10px', borderRadius: '5px', cursor: 'pointer' }}
          onClick={() => handleStartChat(user.uid)}
        >
          {user.displayName || user.email}
        </div>
      ))}
    </div>
  );
}
