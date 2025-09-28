import { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { auth } from "./firebase";
import { onAuthStateChanged } from "firebase/auth";

import AuthPage from "./pages/AuthPage";
import ChatListPage from "./pages/ChatListPage";
import ChatPage from "./pages/ChatPage";

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <Router>
      <Routes>
        {/* Show login/signup if not logged in */}
        {!user ? (
          <>
            <Route path="/" element={<AuthPage />} />
            {/* If not logged in and they try to go to chats, send back to login */}
            <Route path="/chats" element={<Navigate to="/" />} />
            <Route path="/chat/:chatId" element={<Navigate to="/" />} />
          </>
        ) : (
          <>
            {/* If logged in, redirect root to chats */}
            <Route path="/" element={<Navigate to="/chats" />} />
            <Route path="/chats" element={<ChatListPage />} />
            <Route path="/chat/:chatId" element={<ChatPage />} />
          </>
        )}
      </Routes>
    </Router>
  );
}

export default App;
