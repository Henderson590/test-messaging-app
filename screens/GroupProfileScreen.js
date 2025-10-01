// screens/GroupProfileScreen.js
import React, { useState, useEffect } from "react";
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
import { db, auth } from "../firebase";
import {
  doc,
  updateDoc,
  collection,
  getDocs,
  query,
  arrayRemove,
  arrayUnion,
  onSnapshot,
  orderBy,
  where,
} from "firebase/firestore";
import Toast from "react-native-toast-message";
import { useTheme } from "../contexts/ThemeContext";
import { ANIMAL_IMAGES } from "../assets/images";

export default function GroupProfileScreen({ route, navigation }) {
  const { chatId, groupName, members } = route.params;
  const [media, setMedia] = useState([]);
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [memberProfiles, setMemberProfiles] = useState([]);
  const [currentGroupName, setCurrentGroupName] = useState(groupName);
  const { colors } = useTheme();

  // Fetch shared media and links
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

      const mediaItems = allMessages.filter(item => item.image);
      setMedia(mediaItems);

      const linkRegex = /(https?:\/\/[^\s]+)/g;
      const linkItems = allMessages
        .filter(item => item.text && linkRegex.test(item.text))
        .flatMap(item => {
            const foundLinks = item.text.match(linkRegex) || [];
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

  // Fetch member profiles
  useEffect(() => {
    const fetchMemberProfiles = async () => {
      if (!members || members.length === 0) return;
      try {
        const profilesQuery = query(collection(db, "users"), where('__name__', 'in', members));
        const snapshot = await getDocs(profilesQuery);
        const profiles = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));

        // Check friendship status
        const currentUserDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', auth.currentUser.uid)));
        const currentUserFriends = currentUserDoc.docs[0]?.data()?.friends || [];

        const profilesWithFriendship = profiles.map(p => ({
          ...p,
          isFriend: currentUserFriends.includes(p.uid) || p.uid === auth.currentUser.uid,
        }));

        setMemberProfiles(profilesWithFriendship);
      } catch (error) {
        console.error("Error fetching member profiles:", error);
      }
    };
    fetchMemberProfiles();
  }, [members]);

  const handleEditGroupName = () => {
    Alert.prompt(
      "Edit Group Name",
      "Enter a new name for the group.",
      async (newName) => {
        if (newName === null || !newName.trim()) return; // User cancelled or entered empty string

        const groupChatRef = doc(db, "chats", chatId);
        try {
          await updateDoc(groupChatRef, {
            groupName: newName.trim(),
          });
          setCurrentGroupName(newName.trim());
          Toast.show({ type: "success", text1: "Group name updated!" });
        } catch (err) {
          console.error("Failed to update group name:", err);
          Toast.show({ type: "error", text1: "Could not update group name." });
        }
      },
      "plain-text",
      currentGroupName // pre-fill with current name
    );
  };

  const handleLeaveGroup = async () => {
    setOptionsVisible(false);
    const groupChatRef = doc(db, "chats", chatId);
    try {
      await updateDoc(groupChatRef, {
        members: arrayRemove(auth.currentUser.uid)
      });
      Toast.show({ type: 'info', text1: `You have left ${groupName}` });
      navigation.popToTop();
    } catch (error) {
      console.error("Error leaving group:", error);
      Toast.show({ type: 'error', text1: 'Failed to leave group.' });
    }
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

  const handleAddFriend = async (targetUser) => {
    const currentUserDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', auth.currentUser.uid)));
    const currentUsername = currentUserDoc.docs[0]?.data()?.username;

    const targetUserRef = doc(db, "users", targetUser.uid);
    await updateDoc(targetUserRef, {
      pendingRequests: arrayUnion({
        fromUid: auth.currentUser.uid,
        fromUsername: currentUsername,
      }),
    });
    Toast.show({ type: 'success', text1: `Friend request sent to ${targetUser.username}!` });
  };

  const renderMediaItem = ({ item }) => (
    <TouchableOpacity onPress={() => navigation.navigate("MediaGalleryScreen", { media, initialIndex: media.findIndex(m => m.id === item.id) })}>
      <Image source={{ uri: item.image }} style={styles.mediaImage} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerSide}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.backArrow}>←</Text>
          </TouchableOpacity>
        </View>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{currentGroupName}</Text>
        <View style={styles.headerSide}>
          <TouchableOpacity onPress={() => setOptionsVisible(true)}>
            <Text style={styles.optionsButton}>...</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.profileInfo, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleEditGroupName}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={[styles.name, { color: colors.text }]}>{currentGroupName} </Text>
            <Text style={{ fontSize: 20 }}>✏️</Text>
          </View>
        </TouchableOpacity>
        <Text style={[styles.username, { color: colors.subtext }]}>{members.length} members</Text>
      </View>

      <View style={styles.membersSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Members</Text>
        <FlatList
          data={memberProfiles}
          keyExtractor={item => item.uid}
          horizontal
          showsHorizontalScrollIndicator={false}
          renderItem={({ item }) => (
            <View style={styles.memberItem}>
              <TouchableOpacity onPress={() => navigation.navigate('UserProfileScreen', { userId: item.uid })}>
                <Image source={ANIMAL_IMAGES[item.profileAnimal?.base || 'capybara']} style={styles.memberAvatar} />
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>{item.username}</Text>
              </TouchableOpacity>
              {!item.isFriend && (
                <TouchableOpacity style={styles.addFriendButton} onPress={() => handleAddFriend(item)}>
                  <Text style={styles.addFriendButtonText}>Add Friend</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        />
      </View>

      <View style={styles.mediaSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Shared Media</Text>
        {loading ? <ActivityIndicator color="#0078d4" /> : media.length > 0 ? (
          <FlatList data={media.slice(0, 3)} renderItem={renderMediaItem} keyExtractor={(item) => item.id} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }} />
        ) : (
          <Text style={[styles.noMediaText, { color: colors.subtext }]}>No images shared yet.</Text>
        )}
      </View>

      <View style={styles.linksSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Shared Links</Text>
        {loading ? <ActivityIndicator color="#0078d4" /> : links.length > 0 ? (
          <>
            {links.slice(0, 3).map(linkItem => (
              <TouchableOpacity key={linkItem.id} style={styles.linkItem} onPress={() => handleLinkPress(linkItem.link)}>
                <Text style={styles.linkText} numberOfLines={1}>{linkItem.link}</Text>
              </TouchableOpacity>
            ))}
          </>
        ) : (
          <Text style={[styles.noMediaText, { color: colors.subtext }]}>No links shared yet.</Text>
        )}
      </View>

      <Modal visible={optionsVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
          <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]} onPress={() => { setOptionsVisible(false); navigation.navigate("CustomizeChatScreen", { chatId }); }}>
              <Text style={[styles.optionText, { color: '#0078d4' }]}>Customize Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]} onPress={() => { setOptionsVisible(false); navigation.navigate('AddGroupMembersScreen', { chatId, currentMembers: members || [] }); }}>
              <Text style={[styles.optionText, { color: '#0078d4' }]}>Add Members</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]} onPress={handleLeaveGroup}>
              <Text style={[styles.optionText, { color: 'red' }]}>Leave Group</Text>
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
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingBottom: 15, paddingHorizontal: 15, borderBottomWidth: 1 },
  headerSide: { flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  backArrow: { fontSize: 24, color: "#0078d4" },
  optionsButton: { fontSize: 24, color: "#0078d4", fontWeight: 'bold', textAlign: 'right' },
  profileInfo: { alignItems: "center", padding: 20, borderBottomWidth: 1 },
  name: { fontSize: 26, fontWeight: "bold", marginBottom: 4 },
  username: { fontSize: 16 },
  mediaSection: { padding: 20 },
  membersSection: { paddingHorizontal: 20, paddingTop: 20 },
  linksSection: { padding: 20, paddingTop: 0 },
  sectionTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 16 },
  mediaImage: { width: 100, height: 100, borderRadius: 8 },
  noMediaText: { textAlign: "center", marginTop: 10 },
  linkItem: { backgroundColor: "#fff", padding: 15, borderRadius: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee' },
  linkText: { color: '#0078d4' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  optionsContainer: { width: '80%', borderRadius: 14 },
  optionButton: { padding: 18, alignItems: 'center', borderBottomWidth: 1 },
  optionText: { fontSize: 18 },
  memberItem: {
    alignItems: 'center',
    marginRight: 15,
    width: 80,
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginBottom: 8,
  },
  memberName: {
    fontSize: 12,
    textAlign: 'center',
  },
  addFriendButton: {
    marginTop: 4,
  },
  addFriendButtonText: {
    color: '#0078d4',
    fontSize: 12,
    fontWeight: '600',
  },
});