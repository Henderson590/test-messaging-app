import React, { useRef, useEffect, useState } from "react";
import { db, auth } from '../firebase';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import "../pages/ChatListPage.css";

export default function CameraPanel({ isOpen }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [showFriendOverlay, setShowFriendOverlay] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);
  // Fetch friends from Firestore when overlay is opened
  useEffect(() => {
    if (!showFriendOverlay) return;
    let unsub = null;
    setLoadingFriends(true);
    const user = auth.currentUser;
    if (!user) {
      setFriends([]);
      setLoadingFriends(false);
      return;
    }
    unsub = onSnapshot(doc(db, "users", user.uid), async (userSnap) => {
      if (userSnap.exists()) {
        const data = userSnap.data();
        const friendUIDs = data.friends || [];
        const nicknamesObj = data.nicknames || {};
        const friendsData = await Promise.all(friendUIDs.map(async (uid) => {
          const friendDoc = await getDoc(doc(db, "users", uid));
          let nickname = nicknamesObj && nicknamesObj[uid] ? nicknamesObj[uid] : undefined;
          return friendDoc.exists()
            ? { uid, ...friendDoc.data(), nickname }
            : { uid, username: "Unknown user", nickname };
        }));
        setFriends(friendsData);
      } else {
        setFriends([]);
      }
      setLoadingFriends(false);
    });
    return () => {
      if (unsub) unsub();
    };
  }, [showFriendOverlay]);

  // Close the captured photo overlay
  const handleClosePhoto = () => setPhoto(null);
  const [error, setError] = useState("");

  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError("Camera access denied or not available.");
      }
    }
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState >= 2) {
      // Calculate 9:16 crop area
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      const targetAspect = 9 / 16;
      let cropWidth = vw;
      let cropHeight = Math.round(vw / targetAspect);
      if (cropHeight > vh) {
        cropHeight = vh;
        cropWidth = Math.round(vh * targetAspect);
      }
      // Center crop
      const sx = Math.round((vw - cropWidth) / 2);
      const sy = Math.round((vh - cropHeight) / 2);
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      const ctx = canvas.getContext("2d");
      ctx.save();
      ctx.translate(cropWidth, 0); // move to right edge
      ctx.scale(-1, 1); // mirror horizontally
      ctx.drawImage(video, sx, sy, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
      ctx.restore();
      const dataUrl = canvas.toDataURL("image/png");
      setPhoto(dataUrl);
    }
  };

  const handleDownload = () => {
    if (photo) {
      const a = document.createElement("a");
      a.href = photo;
      a.download = "photo.png";
      a.click();
    }
  };

  return (
    <div className="camera-panel" style={{ height: '100vh', justifyContent: 'center', position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {/* Show captured photo in a fixed box above camera preview */}
      {photo && (
        <div style={{
          width: '40vw',
          maxWidth: 320,
          aspectRatio: '9/16',
          borderRadius: 16,
          overflow: 'hidden',
          background: '#fff',
          boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          position: 'absolute',
          top: 32,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 100,
          border: '2px solid #0078d4',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
        }}>
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img src={photo} alt="Captured" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 16 }} />
            {/* Overlayed buttons at top center */}
            <div style={{ position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 12, zIndex: 101 }}>
              <button onClick={handleDownload} style={{ padding: '10px 22px', borderRadius: 12, background: '#00a86b', color: '#fff', border: 'none', fontWeight: 600, fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.10)' }}>Download</button>
              <button
                style={{ padding: '10px 22px', borderRadius: 12, background: '#0078d4', color: '#fff', border: 'none', fontWeight: 600, fontSize: '1.05rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.10)', minWidth: 120, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => setShowFriendOverlay(true)}
              >
                Send to
              </button>
            </div>
            {/* Close X button */}
            <button
              onClick={handleClosePhoto}
              style={{
                position: 'absolute',
                top: 10,
                right: 10,
                background: 'transparent',
                border: 'none',
                color: '#111',
                fontSize: 28,
                fontWeight: 700,
                cursor: 'pointer',
                zIndex: 102,
                padding: 0,
                lineHeight: 1,
              }}
              aria-label="Close photo preview"
            >
              &#10005;
            </button>
          </div>
        </div>
      )}

      {/* Friend selection left-side panel (only when Send to is pressed and photo exists) */}
      {showFriendOverlay && photo && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          bottom: 0,
          width: 380,
          background: '#fff',
          boxShadow: '8px 0 32px rgba(0,0,0,0.18)',
          borderRadius: '0 18px 18px 0',
          zIndex: 10001,
          display: 'flex',
          flexDirection: 'column',
          padding: '32px 24px',
          animation: 'slideInLeftPanel 0.3s forwards',
        }}>
          <button
            onClick={() => setShowFriendOverlay(false)}
            style={{ position: 'absolute', top: 18, right: 18, background: 'transparent', border: 'none', color: '#222', fontSize: 28, fontWeight: 700, cursor: 'pointer', zIndex: 10 }}
            aria-label="Close friend selector"
          >&#10005;</button>
          <h3 style={{ marginBottom: 18 }}>Send to Friend</h3>
          {loadingFriends ? (
            <p>Loading friends...</p>
          ) : friends.length === 0 ? (
            <p>No friends found.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {friends.map(friend => (
                <li key={friend.uid} style={{ marginBottom: 12 }}>
                  <button
                    style={{ width: '100%', padding: '12px 18px', borderRadius: 12, background: '#e0f7fa', color: '#222', border: 'none', fontWeight: 600, fontSize: '1.08rem', cursor: 'pointer', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}
                    onClick={async () => {
                      if (!photo || !auth.currentUser) return;
                      // Upload photo to Cloudinary
                      const cloudName = "dx2yetm8n";
                      const uploadPreset = "test-messaging-app";
                      const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
                      const formData = new FormData();
                      formData.append("file", photo);
                      formData.append("upload_preset", uploadPreset);
                      let imageUrl = null;
                      try {
                        const res = await fetch(url, { method: "POST", body: formData });
                        const data = await res.json();
                        imageUrl = data.secure_url;
                      } catch (e) {
                        toast.error("Picture failed to send", {
                            position: "top-center",
                            autoClose: 2000,
                        });
                        return;
                      }
                      // Compose chatId
                      const myUid = auth.currentUser.uid;
                      const friendUid = friend.uid;
                      const chatId = myUid > friendUid ? `${friendUid}_${myUid}` : `${myUid}_${friendUid}`;
                      // Add snap message to Firestore
                      const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
                      await addDoc(collection(db, "chats", chatId, "messages"), {
                        type: "snap",
                        imageUrl,
                        senderUid: myUid,
                        recipientUid: friendUid,
                        unopened: true,
                        createdAt: serverTimestamp(),
                      });
                      setShowFriendOverlay(false);
                      setPhoto(null);
                      toast.success("Picture sent successfully!", {
                            position: "top-center",
                            autoClose: 2000,
                        });
                    }}
                  >
                    {friend.nickname || friend.username || friend.email || 'Unknown'}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div style={{
        width: '40vw',
        maxWidth: 320,
        aspectRatio: '9/16',
        position: 'relative',
        margin: '0 auto 18px auto',
        borderRadius: 16,
        overflow: 'hidden',
        background: '#222',
        zIndex: 10,
      }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 16,
            marginTop: 0,
            transform: 'scaleX(-1)',
            background: '#222',
            display: 'block',
          }}
        />
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      {/* Overlay circular button at bottom center */}
      <div style={{ position: 'absolute', bottom: 48, left: '50%', transform: 'translateX(-50%)', zIndex: 30 }}>
        <button
          onClick={handleCapture}
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'linear-gradient(135deg,#0078d4,#00a86b)',
            border: '4px solid #fff',
            boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            fontSize: 0,
            outline: 'none',
            transition: 'background 0.2s',
          }}
          aria-label="Capture Photo"
        >
          <span style={{ width: 32, height: 32, borderRadius: '50%', background: '#fff', display: 'block' }}></span>
        </button>
      </div>
      {/* Download button is now inside the image overlay above */}
    </div>
  );
}
