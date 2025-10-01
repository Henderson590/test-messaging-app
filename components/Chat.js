// components/Chat.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from "react-native";
import { db, auth } from "../firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";

export default function Chat({ chatId, friend }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [imageUri, setImageUri] = useState(null);
  const flatListRef = useRef(null);
  const currentUser = auth.currentUser;

  // Listen for messages in real-time
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: data.uid,
          displayName: data.displayName || "Anonymous",
          text: data.text || "",
          image: data.image || null,
          createdAt: data.createdAt || null,
        };
      });
      setMessages(msgs);
    });
    return () => unsub();
  }, [chatId]);

  // Pick image from gallery
  const pickImage = async () => {
    try {
      const { status } =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission required", "Please allow access to your photos.");
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images, // ✅ correct enum
        quality: 0.7,
      });

      if (!result.canceled && result.assets?.length > 0) {
        setImageUri(result.assets[0].uri); // ✅ fixed for new API
      }
    } catch (err) {
      console.error("ImagePicker error:", err);
      Alert.alert("Error", "Could not open gallery.");
    }
  };

  // Upload image to Cloudinary
  const uploadImageToCloudinary = async (uri) => {
    try {
      const formData = new FormData();
      formData.append("file", {
        uri,
        type: "image/jpeg",
        name: `chat_${Date.now()}.jpg`,
      });
      formData.append("upload_preset", "test-messaging-app"); // 👈 your preset

      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dx2yetm8n/image/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();
      if (data.secure_url) {
        return data.secure_url;
      } else {
        throw new Error("Upload failed: " + JSON.stringify(data));
      }
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      Alert.alert("Upload failed", "Could not upload image to Cloudinary.");
      return null;
    }
  };

  // Send message (text + optional image)
  const sendMessage = async () => {
    if (!input.trim() && !imageUri) return;

    let imageUrl = null;
    try {
      if (imageUri) {
        imageUrl = await uploadImageToCloudinary(imageUri);
        if (!imageUrl) return; // stop if upload failed
        setImageUri(null);
      }

      await addDoc(collection(db, "chats", chatId, "messages"), {
        text: input.trim() || "",
        image: imageUrl || null,
        uid: currentUser.uid,
        displayName: currentUser.displayName || "Anonymous",
        createdAt: serverTimestamp(),
      });

      setInput("");
    } catch (err) {
      console.error("Send message error:", err);
      Alert.alert("Error", "Message failed to send.");
    }
  };

  const renderItem = ({ item }) => {
    const isMe = item.uid === currentUser.uid;
    return (
      <View
        style={[
          styles.messageContainer,
          isMe ? styles.myMessage : styles.friendMessage,
        ]}
      >
        {!isMe && <Text style={styles.senderName}>{item.displayName}</Text>}
        {item.text ? (
          <Text style={isMe ? styles.messageText : styles.friendMessageText}>
            {item.text}
          </Text>
        ) : null}
        {item.image && (
          <Image source={{ uri: item.image }} style={styles.messageImage} />
        )}
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={90}
    >
      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        onContentSizeChange={() =>
          flatListRef.current?.scrollToEnd({ animated: true })
        }
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: true })}
        contentContainerStyle={{ padding: 12 }}
      />

      {/* Input area */}
      <View style={styles.inputContainer}>
        {imageUri && (
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: imageUri }} style={styles.thumbnail} />
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setImageUri(null)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.row}>
          <TouchableOpacity onPress={pickImage} style={styles.actionButton}>
            <Text>📁</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder="Type a message..."
            value={input}
            onChangeText={setInput}
          />
          <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
            <Text style={styles.sendButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  messageContainer: {
    padding: 12,
    marginVertical: 4,
    borderRadius: 12,
    maxWidth: "75%",
  },
  myMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#0078d4",
    borderTopRightRadius: 0,
  },
  friendMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#e0e0e0",
    borderTopLeftRadius: 0,
  },
  messageText: { color: "#fff" },
  friendMessageText: { color: "#000" },
  senderName: { color: "#555", fontSize: 12, marginBottom: 2 },
  messageImage: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginTop: 4,
  },
  inputContainer: {
    padding: 8,
    borderTopWidth: 1,
    borderColor: "#ccc",
    backgroundColor: "#fff",
  },
  row: { flexDirection: "row", alignItems: "center" },
  textInput: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  sendButton: {
    backgroundColor: "#0078d4",
    borderRadius: 24,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  sendButtonText: { color: "#fff", fontWeight: "600" },
  actionButton: { padding: 8 },
  thumbnailContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
    position: "relative",
  },
  thumbnail: { width: 80, height: 80, borderRadius: 12 },
  removeButton: {
    position: "absolute",
    top: -5,
    right: -5,
    backgroundColor: "#ff4d4d",
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: "center",
    alignItems: "center",
  },
});
