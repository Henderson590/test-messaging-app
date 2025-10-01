// screens/CameraScreen.js
import React, { useState, useRef, useEffect } from "react";
import { View, TouchableOpacity, Text, StyleSheet, ActivityIndicator, Image, Modal, FlatList } from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as MediaLibrary from "expo-media-library";
import Toast from "react-native-toast-message";
import { useNavigation, useRoute } from "@react-navigation/native";
import { auth, db } from "../firebase";
import { doc, getDoc, addDoc, collection, serverTimestamp } from "firebase/firestore";

export default function CameraScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { onPhotoTaken } = route.params || {};
  const cameraRef = useRef(null);

  const [permission, requestPermission] = useCameraPermissions();
  const [cameraFacing, setCameraFacing] = useState("back");
  const [photo, setPhoto] = useState(null); // To store the captured photo URI
  const [loading, setLoading] = useState(false);
  const [showFriendSelection, setShowFriendSelection] = useState(false);
  const [friends, setFriends] = useState([]);
  const [loadingFriends, setLoadingFriends] = useState(false);

  // Request camera permission
  useEffect(() => {
    // Also request Media Library permissions for saving photos
    MediaLibrary.requestPermissionsAsync();
    if (!permission) requestPermission();
  }, []);

  const takePhoto = async () => {
    if (!cameraRef.current) return;
    setLoading(true);
    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.7 });
      setPhoto(photo); // Show the preview screen
    } catch (err) {
      console.error("Camera error:", err);
      Toast.show({ type: "error", text1: "Failed to take photo" });
    } finally {
      setLoading(false);
    }
  };

  const flipCamera = () => {
    setCameraFacing((current) => (current === "back" ? "front" : "back"));
  };

  const handleDownload = async () => {
    if (!photo?.uri) return;
    try {
      await MediaLibrary.saveToLibraryAsync(photo.uri);
      Toast.show({ type: "success", text1: "Image saved!" });
    } catch (e) {
      console.error("MediaLibrary save error:", e);
      Toast.show({ type: "error", text1: "Failed to save image" });
    }
  };

  const handleOpenFriendSelection = async () => {
    setShowFriendSelection(true);
    setLoadingFriends(true);
    try {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        const userData = userDoc.data();
        const friendIds = userData.friends || [];
        const friendPromises = friendIds.map((fid) => getDoc(doc(db, "users", fid)));
        const friendDocs = await Promise.all(friendPromises);
        const friendList = friendDocs
          .filter((doc) => doc.exists())
          .map((doc) => ({ uid: doc.id, ...doc.data() }));
        setFriends(friendList);
      }
    } catch (err) {
      console.error("Error fetching friends:", err);
      Toast.show({ type: "error", text1: "Could not load friends" });
    } finally {
      setLoadingFriends(false);
    }
  };

  const handleSendPhoto = async (friend) => {
    if (!photo?.uri || !auth.currentUser) return;
    setLoading(true);
    try {
      // 1. Upload to Cloudinary
      const data = new FormData();
      data.append("file", { uri: photo.uri, type: "image/jpeg", name: `snap_${Date.now()}.jpg` });
      data.append("upload_preset", "test-messaging-app");
      const res = await fetch("https://api.cloudinary.com/v1_1/dx2yetm8n/image/upload", { method: "POST", body: data });
      const file = await res.json();
      if (!file.secure_url) throw new Error("Upload failed");

      // 2. Create chat message in Firestore
      const myUid = auth.currentUser.uid;
      const chatId = [myUid, friend.uid].sort().join("_");
      const displayName = auth.currentUser.displayName || (await getDoc(doc(db, "users", myUid))).data()?.username || "Anonymous";

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: "",
        image: file.secure_url,
        imageWidth: file.width,
        imageHeight: file.height,
        uid: myUid,
        displayName,
        isRead: false,
        createdAt: serverTimestamp(),
      });

      Toast.show({ type: "success", text1: `Photo sent to ${friend.username}!` });

      // 3. Reset state and navigate
      setShowFriendSelection(false);
      setPhoto(null);
      navigation.replace("ChatScreen", { friend });

    } catch (err) {
      console.error("Send photo error:", err);
      Toast.show({ type: "error", text1: "Failed to send photo" });
    } finally {
      setLoading(false);
    }
  };


  if (!permission) {
    // Camera permissions are still loading.
    return <ActivityIndicator style={{ flex: 1 }} size="large" color="#0078d4" />;
  }

  if (!permission.granted) {
    // Camera permissions are not granted yet.
    return (
      <View style={styles.permissionContainer}>
        <Text style={{ textAlign: 'center' }}>We need your permission to show the camera</Text>
        <TouchableOpacity onPress={requestPermission} style={styles.permissionButton}><Text style={styles.permissionButtonText}>Grant permission</Text></TouchableOpacity>
      </View>
    );
  }

  // Show photo preview if a photo has been taken
  if (photo) {
    return (
      <View style={styles.container}>
        <Image source={{ uri: photo.uri }} style={styles.preview} />
        <TouchableOpacity style={styles.closeButton} onPress={() => setPhoto(null)}>
          <Text style={styles.controlText}>❌</Text>
        </TouchableOpacity>
        <View style={styles.previewControls}>
          <TouchableOpacity style={styles.previewButton} onPress={handleDownload}>
            <Text style={styles.previewButtonText}>Download</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.previewButton} onPress={handleOpenFriendSelection}>
            <Text style={styles.previewButtonText}>Send to</Text>
          </TouchableOpacity>
        </View>

        <Modal visible={showFriendSelection} transparent={true} animationType="slide">
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Send to a friend</Text>
              {loadingFriends ? (
                <ActivityIndicator size="large" color="#0078d4" />
              ) : (
                <FlatList
                  data={friends}
                  keyExtractor={(item) => item.uid}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.friendItem} onPress={() => handleSendPhoto(item)} disabled={loading}>
                      <Text style={styles.friendName}>{item.username}</Text>
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text>No friends found.</Text>}
                />
              )}
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowFriendSelection(false)}>
                <Text style={styles.previewButtonText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView style={styles.camera} facing={cameraFacing} ref={cameraRef}>
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={flipCamera}>
            <Text style={styles.controlText}>🔄</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.captureButton} onPress={takePhoto} disabled={loading}>
            <Text style={styles.captureText}>{loading ? "..." : "📸"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.controlButton} onPress={() => navigation.goBack()}>
            <Text style={styles.controlText}>❌</Text>
          </TouchableOpacity>
        </View>
      </CameraView>
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  camera: { flex: 1 },
  preview: { flex: 1 },
  controls: { position: "absolute", bottom: 30, width: "100%", flexDirection: "row", justifyContent: "space-around", alignItems: "center" },
  captureButton: { backgroundColor: "#0078d4", padding: 20, borderRadius: 50, alignItems: "center", justifyContent: "center" },
  captureText: { fontSize: 24, color: "#fff" },
  controlButton: { backgroundColor: "#555", padding: 14, borderRadius: 40, alignItems: "center", justifyContent: "center" },
  controlText: { fontSize: 20, color: "#fff" },
  closeButton: { position: "absolute", top: 50, left: 20, backgroundColor: "rgba(0,0,0,0.5)", padding: 10, borderRadius: 20 },
  permissionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  permissionButton: { backgroundColor: '#0078d4', padding: 15, borderRadius: 10, marginTop: 20 },
  permissionButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  previewControls: { position: "absolute", bottom: 40, width: "100%", flexDirection: "row", justifyContent: "space-evenly" },
  previewButton: { backgroundColor: "#0078d4", paddingVertical: 12, paddingHorizontal: 24, borderRadius: 30 },
  previewButtonText: { color: "#fff", fontSize: 16, fontWeight: "bold" },
  modalContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" },
  modalContent: { width: "85%", maxHeight: "70%", backgroundColor: "white", borderRadius: 20, padding: 20, alignItems: "center" },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 20 },
  friendItem: {
    width: 250,
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    alignItems: "center",
  },
  friendName: { fontSize: 18 },
  modalCloseButton: {
    marginTop: 20,
    backgroundColor: "#ff4d4d",
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20
  },
});
