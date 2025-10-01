// screens/FriendProfileScreen.js
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  FlatList,
  Image,
  ActivityIndicator,
  Linking,
  Pressable,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { db, auth } from "../firebase";
import {
  doc,
  updateDoc,
  getDoc,
  collection,
  query,
  arrayRemove,
  arrayUnion,
  where,
  orderBy,
  onSnapshot,
} from "firebase/firestore";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";

export default function FriendProfileScreen({ route, navigation }) {
  const { friend: initialFriend, chatId } = route.params;
  const [friend, setFriend] = useState(initialFriend);
  const [media, setMedia] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const { colors } = useTheme();

  const fetchFriendData = useCallback(async () => {
    if (!auth.currentUser) return;
    // Fetch latest nickname
    const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    const nicknames = userDoc.data()?.nicknames || {};
    const nickname = nicknames[friend.uid];
    setFriend((prev) => ({ ...prev, nickname }));
  }, [friend.uid]);

  // Refetch data when the screen is focused
  useFocusEffect(
    useCallback(() => {
      fetchFriendData();
    }, [fetchFriendData])
  );

  // Fetch shared media
  useEffect(() => {
    if (!chatId) {
      setLoading(false);
      return;
    }
    const q = query(
      collection(db, "chats", chatId, "messages"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allMessages = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      // Filter for images
      const mediaItems = allMessages.filter(item => item.image);
      setMedia(mediaItems);

      // Filter and extract links from text messages
      const linkRegex = /(https?:\/\/[^\s]+)/g;
      const linkItems = allMessages
        .filter(item => item.text && linkRegex.test(item.text))
        .flatMap(item => {
            const foundLinks = item.text.match(linkRegex) || [];
            // Create a unique object for each link found
            return foundLinks.map((link, index) => ({
                id: `${item.id}-${index}`,
                link: link,
            }));
        });
      setLinks(linkItems);

      setLoading(false);
    });

    return () => unsubscribe();
  }, [chatId]);

  const handleChangeNickname = () => {
    Alert.prompt(
      "Set Nickname",
      `Enter a new nickname for ${friend.username}. Leave blank to remove.`,
      async (newNickname) => {
        if (newNickname === null) return; // User cancelled
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        try {
          await updateDoc(userDocRef, {
            [`nicknames.${friend.uid}`]: newNickname.trim() || null,
          });
          setFriend((prev) => ({ ...prev, nickname: newNickname.trim() || null }));
          Toast.show({ type: "success", text1: "Nickname updated!" });
        } catch (err) {
          console.error("Failed to update nickname:", err);
          Toast.show({ type: "error", text1: "Could not update nickname." });
        }
      },
      "plain-text",
      friend.nickname || ""
    );
  };

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

  const handleRemoveFriend = () => {
    setOptionsVisible(false);
    Alert.alert(
      "Remove Friend",
      `Are you sure you want to remove ${friend.username} as a friend?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            const currentUserRef = doc(db, "users", auth.currentUser.uid);
            const friendRef = doc(db, "users", friend.uid);
            await updateDoc(currentUserRef, { friends: arrayRemove(friend.uid) });
            await updateDoc(friendRef, { friends: arrayRemove(auth.currentUser.uid) });
            Toast.show({ type: 'info', text1: `${friend.username} has been removed.` });
            navigation.popToTop();
          },
        },
      ]
    );
  };

  const handleBlockFriend = () => {
    setOptionsVisible(false);
    Alert.alert(
      "Block Friend",
      `Are you sure you want to block ${friend.username}? This will also remove them as a friend.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Block",
          style: "destructive",
          onPress: async () => {
            const currentUserRef = doc(db, "users", auth.currentUser.uid);
            const friendRef = doc(db, "users", friend.uid);
            // Add to blocked list and remove from friends
            await updateDoc(currentUserRef, {
              blockedUsers: arrayUnion(friend.uid),
              friends: arrayRemove(friend.uid)
            });
            // Also remove self from their friend list
            await updateDoc(friendRef, { friends: arrayRemove(auth.currentUser.uid) });
            Toast.show({ type: 'info', text1: `${friend.username} has been blocked.` });
            navigation.popToTop();
          },
        },
      ]
    );
  };

  const renderMediaItem = ({ item, index }) => {
    const itemKey = item.id || index;
    return (
      <TouchableOpacity
        onPress={() => navigation.navigate("MediaGalleryScreen", { media, initialIndex: media.findIndex(m => m.id === item.id) })}
      >
        <Image source={{ uri: item.image }} style={styles.mediaImage} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setOptionsVisible(true)}>
          <Text style={styles.optionsButton}>...</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.profileInfo, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleChangeNickname}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.name, { color: colors.text }]}>{friend.nickname || friend.username} </Text>
            <Text style={{ fontSize: 20 }}>✏️</Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.username, { color: colors.subtext }]}>@{friend.username}</Text>
        <TouchableOpacity style={styles.viewProfileButton} onPress={() => navigation.navigate('UserProfileScreen', { userId: friend.uid })}>
          <Text style={styles.viewProfileText}>See User Profile</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.mediaSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Shared Media</Text>
        {loading ? (
          <ActivityIndicator color="#0078d4" />
        ) : media.length > 0 ? (
          <>
            <FlatList
              data={media.slice(0, 3)}
              renderItem={renderMediaItem}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            />
            {media.length > 3 && (
              <TouchableOpacity
                style={styles.seeMoreButton}
                onPress={() => navigation.navigate("MediaGalleryScreen", { media, initialIndex: 0 })}
              >
                <Text style={styles.seeMoreText}>See More</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={[styles.noMediaText, { color: colors.subtext }]}>No images shared yet.</Text>
        )}
      </View>

      <View style={styles.linksSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Shared Links</Text>
        {loading ? (
          <ActivityIndicator color="#0078d4" />
        ) : links.length > 0 ? (
          <>
            {links.slice(0, 3).map(linkItem => (
              <TouchableOpacity key={linkItem.id} style={styles.linkItem} onPress={() => handleLinkPress(linkItem.link)}>
                <Text style={styles.linkText} numberOfLines={1}>{linkItem.link}</Text>
              </TouchableOpacity>
            ))}
            {links.length > 3 && (
              <TouchableOpacity style={styles.seeMoreButton}>
                <Text style={styles.seeMoreText}>See More</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <Text style={[styles.noMediaText, { color: colors.subtext }]}>No links shared yet.</Text>
        )}
      </View>

      <Modal visible={optionsVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
          <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
            <TouchableOpacity
              style={[styles.optionButton, { borderBottomColor: colors.border }]}
              onPress={() => {
                setOptionsVisible(false);
                navigation.navigate("CustomizeChatScreen", { chatId });
              }}
            >
              <Text style={[styles.optionText, { color: '#0078d4' }]}>Customize Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]} onPress={handleRemoveFriend}>
              <Text style={[styles.optionText, { color: '#0078d4' }]}>Remove Friend</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]} onPress={handleBlockFriend}>
              <Text style={[styles.optionText, { color: 'red' }]}>Block Friend</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomWidth: 0 }]} onPress={() => setOptionsVisible(false)}>
              <Text style={[styles.optionText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end', // Already correct
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  backArrow: { fontSize: 16, color: "#0078d4", paddingBottom: 2, flex: 1 },
  profileInfo: { alignItems: "center", padding: 20, borderBottomWidth: 1 },
  name: { fontSize: 26, fontWeight: "bold", marginBottom: 4 },
  username: { fontSize: 16 },
  viewProfileButton: {
    marginTop: 15,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#e5e5ea',
    borderRadius: 16,
  },
  viewProfileText: {
    color: '#000',
    fontWeight: '600',
  },
  mediaSection: { padding: 20 },
  linksSection: { padding: 20, paddingTop: 0 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  mediaImage: { width: 100, height: 100, borderRadius: 8 },
  noMediaText: { textAlign: "center", marginTop: 10 },
  seeMoreButton: {
    backgroundColor: "#e5e5ea",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 16,
  },
  seeMoreText: { color: "#000", fontWeight: "600" },
  linkItem: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  linkText: {
    color: '#0078d4',
  },
  optionsButton: { fontSize: 16, color: "#0078d4", fontWeight: 'bold', paddingBottom: 2, flex: 1, textAlign: 'right' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  optionsContainer: {
    margin: 10,
    borderRadius: 14,
  },
  optionButton: {
    padding: 18,
    alignItems: 'center',
    borderBottomWidth: 1,
  },
  optionText: {
    fontSize: 18,
  },
});