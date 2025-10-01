// components/CameraPanel.js
import React, { useRef, useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, StyleSheet, Dimensions, ScrollView, ActivityIndicator } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import { db, auth } from "../firebase";
import { doc, getDoc, onSnapshot, addDoc, collection, serverTimestamp } from "firebase/firestore";

const { width: screenWidth } = Dimensions.get("window");

export default function CameraPanel() {
  const cameraRef = useRef(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState(null);
  const [friends, setFriends] = useState([]);
  const [showFriendOverlay, setShowFriendOverlay] = useState(false);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [error, setError] = useState("");

  // Camera permission
  useEffect(() => {
    if (!permission) requestPermission();
  }, []);

  // Fetch friends when overlay opens
  useEffect(() => {
    if (!showFriendOverlay) return;
    setLoadingFriends(true);
    const user = auth.currentUser;
    if (!user) {
      setFriends([]);
      setLoadingFriends(false);
      return;
    }

    const unsub = onSnapshot(doc(db, "users", user.uid), async (userSnap) => {
      if (userSnap.exists()) {
        const data = userSnap.data();
        const friendUIDs = data.friends || [];
        const nicknamesObj = data.nicknames || {};
        const friendsData = await Promise.all(
          friendUIDs.map(async (uid) => {
            const friendDoc = await getDoc(doc(db, "users", uid));
            let nickname = nicknamesObj[uid] || undefined;
            return friendDoc.exists()
              ? { uid, ...friendDoc.data(), nickname }
              : { uid, username: "Unknown user", nickname };
          })
        );
        setFriends(friendsData);
      } else {
        setFriends([]);
      }
      setLoadingFriends(false);
    });

    return () => unsub();
  }, [showFriendOverlay]);

  const handleCapture = async () => {
    if (cameraRef.current) {
      try {
        const photoData = await cameraRef.current.takePictureAsync({ quality: 0.7, base64: true });
        setPhoto(photoData.uri);
      } catch (e) {
        console.error(e);
        setError("Failed to capture photo");
      }
    }
  };

  const handleDownload = async () => {
    if (photo) {
      try {
        await MediaLibrary.saveToLibraryAsync(photo);
      } catch (e) {
        console.error(e);
      }
    }
  };

  if (!permission) {
    // Camera permissions are still loading.
    return <ActivityIndicator />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.permissionContainer}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}><Text style={styles.buttonText}>Grant permission</Text></TouchableOpacity>
      </View>
    );
  }


  return (
    <View style={styles.container}>
      {error ? <Text style={{ color: "red" }}>{error}</Text> : null}

      {/* Photo preview */}
      {photo && (
        <View style={styles.photoPreview}>
          <Image source={{ uri: photo }} style={styles.photo} />
          <View style={styles.photoButtons}>
            <TouchableOpacity style={styles.downloadButton} onPress={handleDownload}>
              <Text style={styles.buttonText}>Download</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.sendButton} onPress={() => setShowFriendOverlay(true)}>
              <Text style={styles.buttonText}>Send to</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.closeButton} onPress={() => setPhoto(null)}>
            <Text style={{ fontSize: 28 }}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Friend overlay */}
      {showFriendOverlay && photo && (
        <View style={styles.friendOverlay}>
          <TouchableOpacity style={styles.closeOverlay} onPress={() => setShowFriendOverlay(false)}>
            <Text style={{ fontSize: 28 }}>✕</Text>
          </TouchableOpacity>
          <Text style={{ marginBottom: 18, fontSize: 18, fontWeight: "bold" }}>Send to Friend</Text>
          {loadingFriends ? (
            <Text>Loading friends...</Text>
          ) : friends.length === 0 ? (
            <Text>No friends found</Text>
          ) : (
            <ScrollView>
              {friends.map((friend) => (
                <TouchableOpacity
                  key={friend.uid}
                  style={styles.friendButton}
                  onPress={async () => {
                    if (!photo || !auth.currentUser) return;
                    // Upload to Cloudinary
                    const cloudName = "dx2yetm8n";
                    const uploadPreset = "test-messaging-app";
                    const url = `https://api.cloudinary.com/v1_1/${cloudName}/upload`;
                    const formData = new FormData();
                    formData.append("file", {
                      uri: photo,
                      type: "image/png",
                      name: "photo.png",
                    });
                    formData.append("upload_preset", uploadPreset);
                    let imageUrl = null;
                    try {
                      const res = await fetch(url, { method: "POST", body: formData });
                      const data = await res.json();
                      imageUrl = data.secure_url;
                    } catch (e) {
                      return;
                    }

                    const myUid = auth.currentUser.uid;
                    const friendUid = friend.uid;
                    const chatId = myUid > friendUid ? `${friendUid}_${myUid}` : `${myUid}_${friendUid}`;

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
                  }}
                >
                  <Text style={{ fontWeight: "600" }}>{friend.nickname || friend.username}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* Camera */}
      <View style={styles.cameraWrapper}>
        <CameraView ref={cameraRef} style={styles.camera} facing={"front"} />
      </View>

      {/* Capture button */}
      <TouchableOpacity style={styles.captureButton} onPress={handleCapture}>
        <View style={styles.innerButton} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  cameraWrapper: { width: screenWidth * 0.5, aspectRatio: 9 / 16, borderRadius: 16, overflow: "hidden", marginBottom: 20 },
  camera: { flex: 1 },
  captureButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#0078d4",
    borderWidth: 4,
    borderColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
  },
  innerButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#fff",
  },
  photoPreview: {
    position: "absolute",
    top: "10%",
    width: screenWidth * 0.7,
    aspectRatio: 9 / 16,
    borderRadius: 16,
    backgroundColor: "#fff",
    zIndex: 100,
    alignItems: "center",
    justifyContent: "flex-start",
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  photo: { width: "100%", height: "100%", borderRadius: 16 },
  photoButtons: { position: "absolute", top: 16, flexDirection: "row", gap: 12 },
  downloadButton: { padding: 10, borderRadius: 12, backgroundColor: "#00a86b" },
  sendButton: { padding: 10, borderRadius: 12, backgroundColor: "#0078d4", marginLeft: 12 },
  buttonText: { color: "#fff", fontWeight: "600" },
  closeButton: { position: "absolute", top: -10, right: 5 },
  friendOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    bottom: 0,
    width: screenWidth * 0.9,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 24,
    zIndex: 101,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  closeOverlay: { position: "absolute", top: 18, right: 18 },
  friendButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#e0f7fa",
    marginBottom: 12,
  },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionButton: { backgroundColor: '#0078d4', padding: 15, borderRadius: 10, marginTop: 20 },
});
