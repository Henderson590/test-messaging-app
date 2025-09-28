import React from "react";
import { auth } from "../firebase";
import { signOut } from "firebase/auth";
import Chat from "../components/Chat";
import { useParams } from "react-router-dom";

export default function ChatPage({ profile }) {
  const { chatId } = useParams();

  if (!profile) return <p>Loading...</p>;

  const handleLogout = async () => {
    await signOut(auth);
    alert("You have logged out!");
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minHeight: '100vh', paddingTop: '50px' }}>
      <h1>Mini Chat</h1>
      <p>Welcome, {profile.displayName}!</p>
      <button onClick={handleLogout}>Log Out</button>
      <Chat profile={profile} chatId={chatId} />
    </div>
  );
}
