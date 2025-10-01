// screens/ChatScreen.js
import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Alert,
  Modal,
  Pressable,
  Animated,
  Linking,
} from "react-native";
import { Swipeable } from "react-native-gesture-handler";
import { auth, db } from "../firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  writeBatch,
  setDoc,
  deleteDoc,
} from "firebase/firestore";
import * as ImagePicker from "expo-image-picker";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect } from "@react-navigation/native";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";
import { ANIMAL_IMAGES, HAT_IMAGES } from "../assets/images";

export default function ChatScreen({ route, navigation }) {
  const { friend: routeFriend, chatId: routeChatId, isGroup, groupName, members } = route.params || {};
  const [friend, setFriend] = useState(routeFriend || null);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [messages, setMessages] = useState([]);
  const [imageUri, setImageUri] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  // State for message actions
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [actionSheetVisible, setActionSheetVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [editingMessage, setEditingMessage] = useState(null);
  const [isFriendTyping, setIsFriendTyping] = useState(false);
  const typingTimeout = useRef(null);
  const [processedMessages, setProcessedMessages] = useState([]);
  const [chatTheme, setChatTheme] = useState('#0078d4'); // Default color
  const [chatEmoji, setChatEmoji] = useState('👍'); // Default emoji
  const { colors } = useTheme();


  // State for full-screen image animation
  const [activeImage, setActiveImage] = useState(null);
  const rowRefs = useRef({});

  const flatListRef = useRef(null);

  const chatId =
    routeChatId ||
    (currentUser && friend
      ? [currentUser.uid, friend.uid].sort().join("_")
      : null);

  // Check auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) navigation.replace("AuthScreen");
      else setCurrentUser(user);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, []);

  // Fetch latest friend data (including nickname) when screen is focused
  useFocusEffect(
    React.useCallback(() => {
      if (isGroup || !friend?.uid || !currentUser?.uid) return;

      // Listener for the friend's profile data for real-time updates
      const friendDocRef = doc(db, "users", friend.uid);
      const unsubFriend = onSnapshot(friendDocRef, async (friendDoc) => {
        if (friendDoc.exists()) {
          const friendData = friendDoc.data();

          // We still need the nickname from the current user's doc
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          const nicknames = userDoc.data()?.nicknames || {};
          const nickname = nicknames[friend.uid];

          // Birthday Check
          const today = new Date();
          const todayString = `${today.getMonth() + 1}/${today.getDate()}`;
          const birthdayString = friendData.birthday?.substring(0, friendData.birthday.lastIndexOf('/'));
          const isBirthday = todayString === birthdayString;

          setFriend((prev) => ({ ...prev, ...friendData, nickname, isBirthday }));
        }
      });

      return () => unsubFriend(); // Cleanup the listener when the screen loses focus
    }, [friend?.uid, currentUser?.uid, isGroup])
  );

  // Listen to chat messages
  useEffect(() => {
    if (!chatId) return;
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "desc") // Fetch newest messages first
    );
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const msgs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMessages(msgs);

      // Mark messages as read
      if (snapshot.docs.length > 0) {
        const batch = writeBatch(db);
        let hasUnread = false;
        snapshot.docs.forEach(doc => {
          const message = doc.data();
          if (message.uid !== currentUser.uid && !message.isRead) {
            batch.update(doc.ref, { isRead: true });
            hasUnread = true;
          }
        });
        if (hasUnread) {
          await batch.commit();
        }
      }
    });
    return () => unsubscribe();
  }, [chatId, currentUser]);

  // Listen for chat theme changes
  useEffect(() => {
    if (!chatId) return;
    const settingsRef = doc(db, 'chats', chatId, 'settings', 'theme');
    const unsubscribe = onSnapshot(settingsRef, (doc) => {
      if (doc.exists()) {
        setChatTheme(doc.data().color || '#0078d4');
        setChatEmoji(doc.data().emoji || '👍');
      } else {
        setChatTheme('#0078d4'); // Reset to default if no setting
        setChatEmoji('👍');
      }
    });
    return () => unsubscribe();
  }, [chatId]);

  // Process messages to add date separators
  useEffect(() => {
    const messagesWithSeparators = [];
    // Since messages are newest to oldest, we iterate backwards to group them correctly.
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];
      const messageDate = message.createdAt?.toDate();
      const messageDateString = messageDate?.toDateString();

      // Get the date of the previous message in the processed list
      const lastItem = messagesWithSeparators[messagesWithSeparators.length - 1];
      const lastDateString = lastItem?.createdAt?.toDate().toDateString();

      // If the date is different, add a separator
      if (messageDateString && messageDateString !== lastDateString) {
        messagesWithSeparators.push({
          id: `separator-${messageDateString}`,
          type: 'date_separator',
          date: messageDate,
        });
      }

      messagesWithSeparators.push({ ...message, type: 'message' });
    }

    setProcessedMessages(messagesWithSeparators.reverse()); // Reverse the final array for the inverted list
  }, [messages]);


  // Listen for friend's typing status
  useEffect(() => {
    if (isGroup || !chatId || !friend?.uid) return; // Disable for group chats for now
    const friendTypingRef = doc(db, "chats", chatId, "typing", friend.uid);
    const unsubscribe = onSnapshot(friendTypingRef, (doc) => {
      setIsFriendTyping(doc.exists());
    });
    return () => unsubscribe();
  }, [chatId, friend?.uid, isGroup]);

  // Update our own typing status
  const updateTypingStatus = async (isTyping) => {
    if (!chatId || !currentUser?.uid) return;
    const typingRef = doc(db, "chats", chatId, "typing", currentUser.uid);
    try {
      if (isTyping) {
        await setDoc(typingRef, { typing: true });
      } else {
        await deleteDoc(typingRef);
      }
    } catch (err) {
      console.error("Failed to update typing status:", err);
    }
  };

  const handleTextChange = (newText) => {
    setText(newText);
    if (typingTimeout.current) clearTimeout(typingTimeout.current);
    updateTypingStatus(true);
    typingTimeout.current = setTimeout(() => {
      updateTypingStatus(false);
    }, 3000); // User is considered "stopped" after 3 seconds
  };

  const pickImage = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        return Toast.show({ type: "error", text1: "Permission denied" });
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.7,
      });
      if (!result.canceled && result.assets?.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.error("ImagePicker error:", err);
      Toast.show({ type: "error", text1: "Failed to pick image" });
    }
  };

  const uploadImage = async (uri) => {
    try {
      setUploadProgress(0);
      progressAnim.setValue(0);
      const data = new FormData();
      data.append("file", { uri, type: "image/jpeg", name: `chat_${Date.now()}.jpg` });
      data.append("upload_preset", "test-messaging-app");

      const res = await fetch(
        "https://api.cloudinary.com/v1_1/dx2yetm8n/image/upload",
        { method: "POST", body: data }
      );
      const file = await res.json();
      if (!file.secure_url) throw new Error("Upload failed");

      Animated.timing(progressAnim, {
        toValue: 100,
        duration: 300,
        useNativeDriver: false,
      }).start();

      setUploadProgress(100);
      return file; // Return the full file object
    } catch (err) {
      console.error("Upload error:", err);
      Toast.show({ type: "error", text1: "Image upload failed" });
      setUploadProgress(0);
      return null;
    }
  };

  const openImage = (item, index) => {
    setActiveImage(item);
  };

  const closeImage = () => {
    setActiveImage(null);
  };

  const handleLongPress = (message) => {
    setSelectedMessage(message);
    setActionSheetVisible(true);
  };

  const handleReply = () => {
    setReplyingTo(selectedMessage);
    setActionSheetVisible(false);
    setSelectedMessage(null);
  };

  const handleSaveImage = async () => {
    if (!selectedMessage?.image) return;
    try {
      // Request permissions if not already granted
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Toast.show({ type: "error", text1: "Permission required to save images." });
        return;
      }
      await MediaLibrary.saveToLibraryAsync(selectedMessage.image);
      Toast.show({ type: "success", text1: "Image saved to gallery!" });
    } catch (err) {
      console.error("Failed to save image:", err);
      Toast.show({ type: "error", text1: "Could not save image." });
    } finally {
      setActionSheetVisible(false);
      setSelectedMessage(null);
    }
  };

  const handleEdit = () => {
    setEditingMessage(selectedMessage);
    setText(selectedMessage.text); // Pre-fill input with current text
    setActionSheetVisible(false);
    setSelectedMessage(null);
  };

  const cancelEdit = () => {
    setEditingMessage(null);
    setText("");
  };

  const handleSwipeToReply = (message) => {
    setReplyingTo(message);
    // Close the swipeable row after setting the reply context
    if (rowRefs.current[message.id]) {
      rowRefs.current[message.id].close();
    }
  };

  const handleReaction = async (message, emoji) => {
    if (!message || !currentUser) return;
    const messageRef = doc(db, "chats", chatId, "messages", message.id);

    const currentReactions = message.reactions || {};
    const reactedUsers = currentReactions[emoji] || [];
    const userHasReacted = reactedUsers.includes(currentUser.uid);

    let updatedReactions = { ...currentReactions };

    if (userHasReacted) {
      // Remove user's reaction
      updatedReactions[emoji] = reactedUsers.filter(uid => uid !== currentUser.uid);
      // If no one is left reacting with this emoji, remove the emoji key
      if (updatedReactions[emoji].length === 0) {
        delete updatedReactions[emoji];
      }
    } else {
      // Add user's reaction
      updatedReactions[emoji] = [...reactedUsers, currentUser.uid];
    }

    await updateDoc(messageRef, { reactions: updatedReactions });
  };

  const handleDeleteMessage = () => {
    if (!selectedMessage || !chatId || !currentUser) return;

    // Close the action sheet before showing the alert
    setActionSheetVisible(false);

    Alert.alert(
      "Delete Message",
      "Are you sure you want to delete this message?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            const messageRef = doc(db, "chats", chatId, "messages", selectedMessage.id);
            await deleteDoc(messageRef);
          },
        },
      ]
    );
  };

  const createMessageObject = (data) => {
    const message = { ...data };
    if (replyingTo) {
      // Determine the correct display name for the person being replied to.
      const isReplyingToMe = replyingTo.uid === currentUser.uid;
      const replyDisplayName = isReplyingToMe ? currentUser.displayName || "You" : (isGroup ? replyingTo.displayName : (friend.nickname || friend.username));

      message.replyTo = {
        id: replyingTo.id,
        text: replyingTo.text || null,
        displayName: replyDisplayName,
      };
    }
    return message;
  };

  const sendQuickEmoji = async () => {
    if (!chatEmoji) return;
    try {
      const displayName = currentUser.displayName || (await getDoc(doc(db, "users", currentUser.uid))).data()?.username || "Anonymous";
      const messageData = {
        text: chatEmoji,
        uid: currentUser.uid,
        displayName,
        isRead: false,
        createdAt: serverTimestamp(),
      };
      await addDoc(collection(db, "chats", chatId, "messages"), messageData);
    } catch (err) {
      console.error("Send quick emoji error:", err);
      Toast.show({ type: "error", text1: "Failed to send emoji" });
    }
  };

  const sendMessage = async () => {
    if (!text.trim() && !imageUri) return;
    setLoading(true);

    // Handle editing a message
    if (editingMessage) {
      const messageRef = doc(db, "chats", chatId, "messages", editingMessage.id);
      await updateDoc(messageRef, {
        text: text.trim(),
        editedAt: serverTimestamp(),
      });
      setEditingMessage(null);
      setText("");
      setLoading(false);
      return;
    }

    try {
      // Fetch currentUser displayName once to avoid "Anonymous"
      const displayName =
        currentUser.displayName ||
        (await getDoc(doc(db, "users", currentUser.uid))).data()?.username ||
        "Anonymous";

      // 1. Handle text message if it exists
      if (text.trim()) {
        const messageData = createMessageObject({
          text,
          uid: currentUser.uid,
          displayName,
          isRead: false,
          createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "chats", chatId, "messages"), messageData);
      }

      // 2. Handle image message if it exists
      if (imageUri) {
        const imageUrl = await uploadImage(imageUri);
        if (imageUrl?.secure_url) {
          const messageData = createMessageObject({
            text: "",
            image: imageUrl.secure_url,
            imageWidth: imageUrl.width,
            imageHeight: imageUrl.height,
            uid: currentUser.uid,
            displayName,
            isRead: false,
            createdAt: serverTimestamp(),
          });
          await addDoc(collection(db, "chats", chatId, "messages"), messageData);
        } else {
          // Stop if image upload fails
          setLoading(false);
          return;
        }
      }

      // Reset text input
      setText("");
      // Reset image state after sending
      setImageUri(null);
      setUploadProgress(0);
      progressAnim.setValue(0);
      // Reset reply state
      setReplyingTo(null);
    } catch (err) {
      console.error("Send message error:", err);
      Toast.show({ type: "error", text1: "Failed to send message" });
    } finally {
      setLoading(false);
    }
  };

  const renderItem = ({ item, index }) => {
    if (item.type === 'date_separator') {
      const today = new Date();
      const yesterday = new Date();
      yesterday.setDate(today.getDate() - 1);

      let dateText = item.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      if (item.date.toDateString() === today.toDateString()) {
        dateText = 'Today';
      } else if (item.date.toDateString() === yesterday.toDateString()) {
        dateText = 'Yesterday';
      } else if (today.getFullYear() !== item.date.getFullYear()) {
        dateText = item.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
      }

      return (
        <View style={styles.dateSeparatorContainer}>
          <Text style={styles.dateSeparatorText}>{dateText}</Text>
        </View>
      );
    }
    const isMe = item.uid === currentUser?.uid;
    // Find if this is the last message of a consecutive block by the same user
    const nextMessage = messages[index + 1];
    const isLastInBlock = !nextMessage || nextMessage.uid !== item.uid;

    let displayName = item.displayName;

    // --- Link Safety Check ---
    const BLOCKED_DOMAINS = ['onlyfans.com', 'www.onlyfans.com', 'pornhub.com', 'www.pornhub.com']; // Add bad domains here
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const linksInMessage = item.text?.match(urlRegex) || [];
    const hasBlockedLink = linksInMessage.some(link => {
      try {
        const url = new URL(link);
        return BLOCKED_DOMAINS.includes(url.hostname);
      } catch (e) {
        return false; // Invalid URL format
      }
    });
    // --- End Link Safety Check ---

    if (!isMe) {
      displayName = friend?.nickname || friend?.username || item.displayName || "Anonymous";
    }

    const hasText = item.text && item.text.trim().length > 0;

    // Calculate image dimensions for aspect ratio
    const imageStyle = {
      width: 250,
      height: 250, // Default
      borderRadius: 16,
      marginTop: hasText ? 8 : 0,
    };
    if (item.imageWidth && item.imageHeight) {
      imageStyle.height = (imageStyle.width * item.imageHeight) / item.imageWidth;
    }

    const renderReplyAction = () => (
      <View style={styles.swipeReplyContainer}>
        <Text style={styles.swipeReplyIcon}>↩️</Text>
      </View>
    );

    return (
      <Swipeable
        ref={(ref) => (rowRefs.current[item.id] = ref)}
        renderRightActions={!isMe ? renderReplyAction : null}
        renderLeftActions={isMe ? renderReplyAction : null}
        onSwipeableOpen={() => handleSwipeToReply(item)}
        friction={2}
      >
        <View style={{ flexDirection: 'column', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
          {/* Message Bubble */}
          <TouchableOpacity onLongPress={() => handleLongPress(item)} onPress={item.image && !hasText ? () => openImage(item, index) : null} activeOpacity={0.8}>
            {item.image && !hasText ? (
              <View style={{ alignSelf: isMe ? 'flex-end' : 'flex-start' }}>
                {item.replyTo && <ReplyPreview reply={item.replyTo} isMe={isMe} />}
                <Image source={{ uri: item.image }} style={[styles.imageOnlyBubble, imageStyle]} resizeMode="cover" />
              </View>
            ) : (
              <View style={[styles.messageBubble, isMe ? [styles.myMessage, { backgroundColor: chatTheme }] : styles.theirMessage]}>
                {!isMe && (
                  <View style={styles.senderContainer}>
                    {/* We can add the friend's animal image here in the future if desired */}
                    <Text style={styles.senderName}>{displayName}</Text>
                  </View>
                )}
                {item.isStoryReply && item.story ? (
                  <StoryReplyPreview story={item.story} isMe={isMe} />
                ) : item.replyTo ? (
                  <ReplyPreview reply={item.replyTo} isMe={isMe} />
                ) : null}
                {hasText && (
                  hasBlockedLink ? (
                    <Text style={[styles.blockedLinkText, { color: isMe ? '#ffcdd2' : '#555' }]}>This link is not allowed.</Text>
                  ) : (
                    <ParsedText isMe={isMe} text={item.text} editedAt={item.editedAt} />
                  )
                )}
              </View>
            )}
          </TouchableOpacity>

          {/* Reactions */}
          {item.reactions && Object.keys(item.reactions).length > 0 && (
            <View style={[styles.reactionsContainer, { alignSelf: isMe ? 'flex-end' : 'flex-start' }]}>
              {Object.entries(item.reactions).map(([emoji, uids]) =>
                uids.length > 0 ? (
                  <TouchableOpacity
                    key={emoji}
                    style={[styles.reactionBubble, uids.includes(currentUser?.uid) && styles.myReactionBubble]}
                    onPress={() => handleReaction(item, emoji)}
                  >
                    <Text style={styles.reactionEmoji}>{emoji} {uids.length}</Text>
                  </TouchableOpacity>
                ) : null
              )}
            </View>
          )}

          {/* Read Receipt */}
          {isMe && isLastInBlock && <Text style={styles.readReceipt}>{item.isRead ? 'Read' : 'Delivered'}</Text>}
        </View>
      </Swipeable>
    );
  };

  const ReplyPreview = ({ reply, isMe }) => (
    <View style={[styles.replyPreview, isMe ? styles.myReplyPreview : styles.theirReplyPreview]}>
      <Text style={styles.replyPreviewName}>{reply.displayName}</Text>
      <Text style={styles.replyPreviewText} numberOfLines={1}>{reply.text || "Image"}</Text>
    </View>
  );

  const StoryReplyPreview = ({ story, isMe }) => (
    <View style={[styles.replyPreview, isMe ? styles.myReplyPreview : styles.theirReplyPreview, styles.storyReplyPreview]}>
      <Image source={{ uri: story.imageUrl }} style={styles.storyReplyThumbnail} />
      <View style={{ marginLeft: 8, flex: 1 }}>
        <Text style={[styles.replyPreviewName, { color: isMe ? '#fff' : '#000' }]}>Replied to a story</Text>
      </View>
    </View>
  );

  const ParsedText = ({ text, isMe, editedAt }) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlRegex);
  
    const handleLinkPress = (url) => { 
      Alert.alert(
        "Open Link",
        "This will open in a new browser.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Open",
            onPress: () => Linking.openURL(url).catch(err => {
              console.error("Failed to open URL:", err);
              Toast.show({ type: 'error', text1: 'Could not open link.' });
            }),
          },
        ]
      );
    };
  
    return (
      <Text style={isMe ? styles.myMessageText : styles.theirMessageText}>
        {parts.map((part, index) =>
          urlRegex.test(part) ? (<Text key={index} style={[styles.linkText, { color: isMe ? '#b3e5fc' : '#0078d4' }]} onPress={() => handleLinkPress(part)}>{part}</Text>) : (part)
        )}
        {editedAt && <Text style={styles.editedText}> (edited)</Text>}
      </Text>
    );
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return "";
    const date = timestamp.toDate();
    return date.toLocaleString('en-US', {
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true,
    }).replace(' at ', ', at ');
  };

  if (!authChecked)
    return <ActivityIndicator size="large" color="#0078d4" style={{ flex: 1 }} />;
  if (!isGroup && !friend)
    return <Text style={{ flex: 1, textAlign: "center", marginTop: 50, color: colors.text }}>Select a chat</Text>;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior="padding"
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 60} // Use padding for both, with an offset for the header
    >
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: chatTheme }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        {isGroup ? (
          <TouchableOpacity style={styles.headerContent} onPress={() => navigation.navigate('GroupProfileScreen', { chatId, groupName, members })}>
            <Text style={styles.headerTitle}>{groupName}</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => navigation.navigate("FriendProfileScreen", { friend, chatId })}>
            <View style={styles.headerContent}>
              <View style={styles.headerAvatarContainer}>
                <Image source={ANIMAL_IMAGES[friend.profileAnimal?.base || 'capybara']} style={styles.headerAvatarImage} />
                {friend.profileAnimal?.hat && friend.profileAnimal?.hat !== 'None' && <Image source={HAT_IMAGES[friend.profileAnimal.hat]} style={styles.headerAvatarHat} />}
              </View>
              <Text style={styles.headerTitle}>
                {friend.nickname || friend.username || "Chat"} {friend?.isBirthday ? '🎂' : ''}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      </View>

      {activeImage && (
        <Modal visible={!!activeImage} transparent={true} animationType="fade" onRequestClose={closeImage}>
          <Pressable style={styles.fullScreenContainer} onPress={closeImage}>
            <Image source={{ uri: activeImage.image }} style={styles.fullScreenImage} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}
      <FlatList
        ref={flatListRef}
        data={processedMessages}
        inverted
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 12 }}
        ListFooterComponent={
          isFriendTyping ? (
            <Text style={[styles.typingIndicator, { color: colors.subtext }]}>{friend?.nickname || friend?.username} is typing...</Text>
          ) : null
        }
      />

      <View style={styles.inputContainer}>
        {editingMessage && (
          <View style={styles.replyingContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyingTitle}>Editing Message</Text>
              <Text style={styles.replyingText} numberOfLines={1}>{editingMessage.text}</Text>
            </View>
            <TouchableOpacity onPress={cancelEdit}>
              <Text style={styles.replyingClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {replyingTo && (
          <View style={styles.replyingContainer}>
            <View style={{ flex: 1 }}>
              <Text style={styles.replyingTitle}>Replying to {replyingTo.displayName}</Text>
              <Text style={styles.replyingText} numberOfLines={1}>{replyingTo.text || "Image"}</Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Text style={styles.replyingClose}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
        {imageUri && (
          <View style={styles.thumbnailContainer}>
            <Image source={{ uri: imageUri }} style={styles.thumbnail} />
            {uploadProgress > 0 && uploadProgress < 100 && (
              <Animated.View
                style={[
                  styles.progressOverlay,
                  {
                    width: progressAnim.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                    }),
                  },
                ]}
              />
            )}
            <TouchableOpacity style={styles.removeButton} onPress={() => setImageUri(null)}>
              <Text style={{ color: "#fff", fontWeight: "bold" }}>✕</Text>
            </TouchableOpacity>
          </View>
        )}

        <View style={styles.row}>
          <TouchableOpacity onPress={pickImage} style={styles.actionButton} disabled={uploadProgress > 0 && uploadProgress < 100}>
            <Text style={{ fontSize: 24 }}>📁</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => navigation.navigate("CameraScreen")} style={styles.actionButton} disabled={uploadProgress > 0 && uploadProgress < 100}>
            <Text style={{ fontSize: 24 }}>📷</Text>
          </TouchableOpacity>

          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
            placeholder="Type a message"
            value={text}
            multiline
            onChangeText={handleTextChange}
            editable={uploadProgress === 0 || uploadProgress === 100}
          />

          {text.trim() || imageUri ? (
            <TouchableOpacity
              style={[styles.sendButton, { backgroundColor: chatTheme }]}
              onPress={sendMessage}
              disabled={loading || (uploadProgress > 0 && uploadProgress < 100)}
            >
              <Text style={{ color: "#fff", fontWeight: "bold" }}>{loading ? "..." : (editingMessage ? "Save" : "Send")}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.actionButton} onPress={sendQuickEmoji}>
              <Text style={{ fontSize: 28 }}>{chatEmoji}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Modal visible={actionSheetVisible} transparent animationType="fade">
        <Pressable style={styles.actionSheetOverlay} onPress={() => setActionSheetVisible(false)}>
          <View style={[styles.actionSheetContainer, { backgroundColor: colors.background }]}>
            {selectedMessage?.createdAt && (
              <Text style={[styles.timestampText, { color: colors.subtext }]}>{formatTimestamp(selectedMessage.createdAt)}</Text>
            )}
            <View style={styles.emojiReactionRow}>
              {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                <TouchableOpacity key={emoji} onPress={() => { handleReaction(selectedMessage, emoji); setActionSheetVisible(false); }}>
                  <Text style={styles.emojiReaction}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity style={[styles.actionSheetButton, { backgroundColor: colors.surface }]} onPress={handleReply}>
              <Text style={[styles.actionSheetText, { color: colors.text }]}>Reply</Text>
            </TouchableOpacity>
            {selectedMessage?.uid === currentUser.uid && selectedMessage?.text && (
              <TouchableOpacity style={[styles.actionSheetButton, { backgroundColor: colors.surface }]} onPress={handleEdit}>
                <Text style={[styles.actionSheetText, { color: colors.text }]}>Edit</Text>
              </TouchableOpacity>
            )}
            {selectedMessage?.image && (
              <TouchableOpacity style={[styles.actionSheetButton, { backgroundColor: colors.surface }]} onPress={handleSaveImage}>
                <Text style={[styles.actionSheetText, { color: colors.text }]}>Save Image</Text>
              </TouchableOpacity>
            )}
            {selectedMessage?.uid === currentUser.uid && (
              <TouchableOpacity style={[styles.actionSheetButton, { backgroundColor: colors.surface }]} onPress={handleDeleteMessage}>
                <Text style={[styles.actionSheetText, { color: 'red' }]}>Delete</Text>
              </TouchableOpacity>
            )}
            {/* Add more options here */}
            <TouchableOpacity
              style={[styles.actionSheetButton, { marginTop: 8, backgroundColor: "#ff4d4d" }]}
              onPress={() => setActionSheetVisible(false)}
            >
              <Text style={styles.actionSheetText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      <Toast />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 10,
    // backgroundColor will be set by theme
  },
  backArrow: { fontSize: 26, color: "#fff", marginRight: 15, paddingBottom: 2 },
  headerTitle: { fontSize: 20, color: "#fff", fontWeight: "bold" },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatarContainer: {
    width: 40,
    height: 40,
    marginRight: 10,
    position: 'relative',
  },
  headerAvatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  headerAvatarHat: {
    position: 'absolute',
    width: '70%',
    height: '70%',
    top: -15,
    left: 5.5 // Adjust for header size
  },
  inputContainer: { padding: 8, borderTopWidth: 1, paddingBottom: 40 },
  row: { flexDirection: "row", alignItems: "center" },
  input: { flex: 1, maxHeight: 120, borderWidth: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16},
  sendButton: { borderRadius: 24, paddingHorizontal: 16, paddingVertical: 12 },
  actionButton: { padding: 8 },
  messageBubble: { maxWidth: "75%", marginBottom: 8, padding: 12, borderRadius: 16 },
  myMessage: { alignSelf: "flex-end", borderTopRightRadius: 0 },
  theirMessage: { backgroundColor: "#e5e5ea", alignSelf: "flex-start", borderTopLeftRadius: 0 }, // This color should be themed too
  myMessageText: { color: "#fff" },
  theirMessageText: { color: "#000" },
  imageOnlyBubble: { maxWidth: 250, borderRadius: 16, overflow: "hidden", marginBottom: 8 },
  linkText: { textDecorationLine: 'underline' },
  blockedLinkText: { fontStyle: 'italic', opacity: 0.8 },
  senderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  senderName: { color: "#555", fontSize: 12, marginBottom: 2 },
  thumbnailContainer: { flexDirection: "row", alignItems: "center", marginBottom: 8, position: "relative" },
  thumbnail: { width: 80, height: 80, borderRadius: 12 },
  removeButton: { position: "absolute", top: -5, right: -5, backgroundColor: "#ff4d4d", borderRadius: 12, width: 24, height: 24, justifyContent: "center", alignItems: "center" },
  progressOverlay: { position: "absolute", height: "100%", backgroundColor: "rgba(0,120,212,0.4)", borderRadius: 12, top: 0, left: 0 },
  replyingContainer: { flexDirection: "row", alignItems: "center", padding: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  replyingTitle: { fontWeight: "bold", fontSize: 13, color: "#0078d4" },
  replyingText: { color: "#555", fontSize: 13 },
  replyingClose: { fontSize: 16, color: "#888", padding: 8 },
  replyPreview: { borderLeftWidth: 3, paddingLeft: 8, marginBottom: 6, opacity: 0.8 },
  myReplyPreview: { borderColor: "#fff" },
  theirReplyPreview: { borderColor: "#0078d4" },
  replyPreviewName: { fontWeight: "bold", fontSize: 12 },
  replyPreviewText: { fontSize: 12 },
  storyReplyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  storyReplyThumbnail: {
    width: 30,
    height: 40,
    borderRadius: 4,
  },
  actionSheetOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  actionSheetContainer: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 16 },
  actionSheetButton: {
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  actionSheetText: {
    fontSize: 16,
    fontWeight: "600",
  },
  timestampText: { fontSize: 13, textAlign: "center", marginBottom: 16 },
  editedText: { fontSize: 12, color: "#adadadff", fontStyle: "italic", marginLeft: 8 },
  readReceipt: { fontSize: 12, marginTop: 2, marginRight: 4, alignSelf: 'flex-end' },
  typingIndicator: { fontSize: 12, fontStyle: "italic", paddingLeft: 12, height: 20 },
  reactionsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 4 },
  reactionBubble: { backgroundColor: '#e5e5ea', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, marginRight: 4, marginBottom: 4 },
  myReactionBubble: { backgroundColor: '#d0e8ff', borderWidth: 1, borderColor: '#0078d4' },
  reactionEmoji: { fontSize: 14 },
  emojiReactionRow: { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#fff', borderRadius: 20, paddingVertical: 12, marginBottom: 16 },
  emojiReaction: { fontSize: 28 },
  dateSeparatorContainer: { alignItems: 'center', marginVertical: 10 },
  dateSeparatorText: { color: '#666', backgroundColor: '#e5e5ea', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', fontSize: 12, fontWeight: '600' },
  swipeReplyContainer: { justifyContent: 'center', alignItems: 'center', width: 70 },
  swipeReplyIcon: { fontSize: 24 },
  fullScreenContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
});
