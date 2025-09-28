import React, { useState, useEffect, useRef } from "react";
import { db, auth, storage } from "../firebase";
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  doc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export default function Chat({ friend, currentUser, onClose }) {
  // chatId must be defined before any hooks reference it
  const chatId =
    friend && auth.currentUser
      ? auth.currentUser.uid > friend.uid
        ? `${friend.uid}_${auth.currentUser.uid}`
        : `${auth.currentUser.uid}_${friend.uid}`
      : null;

  // Nickname state (per user)
  const [nickname, setNickname] = useState("");
  const [editingNickname, setEditingNickname] = useState(false);

  // Load nickname from current user's nicknames object
  useEffect(() => {
    const fetchNickname = async () => {
      if (!currentUser || !friend) return;
      try {
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.nicknames && data.nicknames[friend.uid]) {
            setNickname(data.nicknames[friend.uid]);
          } else {
            setNickname("");
          }
        }
      } catch (e) {}
    };
    fetchNickname();
  }, [currentUser, friend]);

  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const messagesEndRef = useRef(null);
  const [chatColor, setChatColor] = useState("#0078d4");

  // Load chatColor from Firestore 'color' field in chatId document
  useEffect(() => {
    const fetchColor = async () => {
      if (!chatId) return;
      try {
        const chatDoc = await getDoc(doc(db, "chats", chatId));
        if (chatDoc.exists()) {
          const data = chatDoc.data();
          if (data.color) {
            setChatColor(data.color);
          }
        }
      } catch (e) {
        // fallback to localStorage on error
        const stored = localStorage.getItem(`chatColor_${chatId}`);
        if (stored) setChatColor(stored);
      }
    };
    fetchColor();
  }, [chatId]);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // contrast helper
  const getContrastColor = (hex) => {
    if (!hex) return '#fff';
    const h = hex.replace('#','');
    const r = parseInt(h.substring(0,2),16);
    const g = parseInt(h.substring(2,4),16);
    const b = parseInt(h.substring(4,6),16);
    const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
    return luminance > 0.6 ? '#111' : '#fff';
  };

  // save color persistently when changed
  useEffect(() => {
    try { if (chatId) localStorage.setItem(`chatColor_${chatId}`, chatColor); } catch (e) {}
  }, [chatColor, chatId]);

  // Load messages in real-time
  useEffect(() => {
    if (!chatId) return;
    const messagesRef = collection(db, "chats", chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setMessages(msgs);
    });
    return unsubscribe;
  }, [chatId]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle sending message (text + optional image)
  const handleSend = async (e) => {
    e.preventDefault();
    if (!chatId || (!newMessage.trim() && !imageUrl)) return;

    try {
      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: newMessage.trim() || null,
        senderUid: currentUser.uid,
        displayName:
          currentUser.username || auth.currentUser.displayName || "Unknown",
        imageUrl: imageUrl || null,
        createdAt: serverTimestamp(),
        color: chatColor // Add color field to each message
      });

      setNewMessage("");
      setImageFile(null);
      setImageUrl(null);
      setUploadProgress(0);
      setIsUploading(false);
    } catch (err) {
      console.error("Error sending message:", err);
    }
  };

  // Handle image selection and instant upload
  const handleImageChange = async (e) => {
    if (!e.target.files[0]) return;

    const file = e.target.files[0];
    setImageFile(file);
    setIsUploading(true);
    setUploadProgress(0);

    // Cloudinary unsigned upload
    const cloudName = "dx2yetm8n"; // <-- Replace with your Cloudinary cloud name
    const uploadPreset = "test-messaging-app"; // <-- Replace with your unsigned upload preset
    const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    try {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percent = Math.round((event.loaded / event.total) * 100);
          setUploadProgress(percent);
        }
      };

      xhr.onload = () => {
        if (xhr.status === 200) {
          const response = JSON.parse(xhr.responseText);
          setImageUrl(response.secure_url);
          setIsUploading(false);
          setUploadProgress(100);
        } else {
          console.error("Cloudinary upload failed:", xhr.responseText);
          setIsUploading(false);
          setUploadProgress(0);
        }
      };

      xhr.onerror = () => {
        console.error("Cloudinary upload error");
        setIsUploading(false);
        setUploadProgress(0);
      };

      xhr.send(formData);
    } catch (err) {
      console.error("Error uploading image:", err);
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setImageUrl(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  if (!friend) return null;

  return (
    <div className="chat-container">
      <div className="chat-header" style={{ background: chatColor, background: "linear-gradient(90deg,#ffb6b6,#b6eaff)", display: 'flex', alignItems: 'center', position: 'relative', paddingLeft: 0 }}>
        {/* X close button on left, vertically centered */}
        <button
          aria-label="Close chat"
          onClick={() => { if (onClose) onClose(); }}
          style={{
            marginLeft: 8,
            marginRight: 16,
            width: 32,
            height: 32,
            borderRadius: '50%',
            background: 'rgba(0,0,0,0.12)',
            color: getContrastColor(chatColor),
            border: 'none',
            fontSize: '20px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.background = 'rgba(0,0,0,0.22)'}
          onMouseOut={e => e.currentTarget.style.background = 'rgba(0,0,0,0.12)'}
        >
          &#10005;
        </button>
        <div style={{ flex: 1, textAlign: 'center', fontWeight: 'bold', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {nickname || friend.username || "Unknown"}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', marginRight: 12 }}>
          {editingNickname ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                if (currentUser && friend) {
                  try {
                    await updateDoc(doc(db, "users", currentUser.uid), {
                      [`nicknames.${friend.uid}`]: nickname
                    });
                  } catch (e) {}
                }
                setEditingNickname(false);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
            >
              <input
                type="text"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                style={{ borderRadius: 20, border: '1px solid #b3b3b3', padding: '6px 8px', fontSize: '15px', marginLeft: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', outline: 'none', width: '120px' }}
                placeholder="Enter nickname"
                maxLength={32}
                autoFocus
              />
              <button type="submit" style={{ fontSize: '15px', borderRadius: 20, border: 'none', background: 'linear-gradient(90deg,#0078d4,#00a86b)', color: '#fff', padding: '6px 16px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', fontWeight: 500 }}>Save</button>
              <button type="button" onClick={() => setEditingNickname(false)} style={{ fontSize: '15px', borderRadius: 20, border: 'none', background: '#eee', color: '#222', padding: '6px 16px', cursor: 'pointer', marginLeft: 4, fontWeight: 500 }}>Cancel</button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setEditingNickname(true)}
              style={{ fontSize: '15px', borderRadius: 20, border: 'none', background: 'linear-gradient(90deg,#0078d4,#00a86b)', color: '#fff', padding: '6px 16px', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.10)', fontWeight: 500 }}
            >
              ✏️ Edit Name
            </button>
          )}
        </div>
      </div>

      <div className="chat-messages">
        {messages.length === 0 && !imageFile && (
          <p>No messages sent, send a message to get started!</p>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={msg.senderUid === currentUser.uid ? "sent" : "received"}
          >
            {msg.displayName && <strong>{msg.displayName}: </strong>}
            {msg.text && <span>{msg.text}</span>}
            {msg.imageUrl && (
              <img
                src={msg.imageUrl}
                alt="sent"
                style={{
                  width: "400px",
                  height: "250px",
                  objectFit: "cover",
                  borderRadius: "18px",
                  margin: "18px auto",
                  boxShadow: "0 2px 12px rgba(0,0,0,0.10)",
                  background: "#f8f8f8",
                  border: "none"
                }}
              />
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input container */}
      <form
        onSubmit={handleSend}
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "6px",
          padding: "6px",
          borderRadius: "20px",
          background: "#f0f0f0",
        }}
      >
        {/* Image preview inside input pill */}
        {imageFile && (
          <div
            style={{
              position: "relative",
              borderRadius: "10px",
              overflow: "hidden",
              maxHeight: "80px",
              maxWidth: "120px",
              marginBottom: "6px",
            }}
          >
            <img
              src={URL.createObjectURL(imageFile)}
              alt="preview"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
            <button
              type="button"
              onClick={removeImage}
              style={{
                position: "absolute",
                top: "-20px",
                right: "-5px",
                width: "24px",
                height: "24px",
                borderRadius: "50%",
                background: "transparent",
                color: "white",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold",
              }}
            >
              ✕
            </button>
          </div>
        )}

        {/* Progress bar above input row */}
        {imageFile && isUploading && uploadProgress < 100 && (
          <div
            style={{
              height: "6px",
              width: "100%",
              background: "#e0e0e0",
              borderRadius: "3px",
              overflow: "hidden",
              marginBottom: "6px",
            }}
          >
            <div
              style={{
                width: `${uploadProgress}%`,
                height: "100%",
                background: 'linear-gradient(135deg,#0078d4,#00a86b)',
                transition: "width 0.2s",
              }}
            />
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {/* Camera icon */}
          <label htmlFor="image-upload" style={{ cursor: "pointer", fontSize: "20px" }}>
            📷
          </label>
          <input
            type="file"
            id="image-upload"
            accept="image/*"
            onChange={handleImageChange}
            style={{ display: "none" }}
          />

          {/* Text input */}
          <input
            type="text"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "20px",
              border: "1px solid #ccc",
              outline: "none",
            }}
          />

          {/* Send button */}
          <button
            type="submit"
            disabled={isUploading}
            style={{
              padding: "8px 14px",
              borderRadius: "20px",
              background: 'linear-gradient(135deg,#0078d4,#00a86b)',
              color: "white",
              border: "none",
              cursor: isUploading ? "not-allowed" : "pointer",
            }}
          >
            Send
          </button>
        </div>
      </form>
  </div>
  );
}
