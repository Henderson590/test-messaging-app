// HomeScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert, Modal, Pressable, Image } from "react-native";
import { auth, db } from "../firebase";
import { doc, updateDoc, arrayUnion, arrayRemove, onSnapshot, collection, query, where, getDocs } from "firebase/firestore";
import Navbar from "../components/Navbar";
import { useTheme } from "../contexts/ThemeContext";
import { ANIMAL_IMAGES, HAT_IMAGES } from "../assets/images";
import Toast from "react-native-toast-message";
import * as Notifications from 'expo-notifications';

export default function HomeScreen({ navigation }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [chats, setChats] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [unreadChats, setUnreadChats] = useState({});
  const { colors } = useTheme();
  const unreadListenersRef = React.useRef([]);
  const groupChatListenerRef = React.useRef(null);

  // Register for push notifications
  useEffect(() => {
    const registerForPushNotificationsAsync = async () => {
      if (!auth.currentUser) return;
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted') {
        return;
      }
      const token = (await Notifications.getExpoPushTokenAsync({ projectId: 'e63a1921-2d64-4424-825c-93997f3419f3' })).data;

      // Save the token to the user's document in Firestore
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, { pushToken: token });
    };
    registerForPushNotificationsAsync();
  }, []);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      // If for some reason there's no user, don't do anything.
      // The user might be logged out by another screen.
      setLoading(false);
      return;
    }

      setUser(currentUser);

      // Set up a listener for the current user's document
      const userDocRef = doc(db, "users", currentUser.uid);
      const unsubUserData = onSnapshot(userDocRef, async (userDoc) => {
        if (userDoc.exists()) {
          const userData = userDoc.data();

          const nicknames = userData.nicknames || {};
          const favorites = userData.favorites || [];
          const friendIds = userData.friends || [];

          // --- Step 1: Fetch and display friends (1-on-1 chats) ---
          let friends = [];
          if (friendIds.length > 0) {
            const friendsQuery = query(collection(db, "users"), where("__name__", "in", friendIds));
            const friendsSnapshot = await getDocs(friendsQuery);
            friends = friendsSnapshot.docs.map((friendDoc) => ({
              uid: friendDoc.id,
              isGroup: false,
              ...friendDoc.data(),
              nickname: nicknames[friendDoc.id],
              isFavorite: favorites.includes(friendDoc.id),
            }));
          }

          // --- Step 2: Set up a real-time listener for group chats ---
          // Clean up previous listener if it exists
          if (groupChatListenerRef.current) {
            groupChatListenerRef.current();
          }

          const groupChatsQuery = query(collection(db, "chats"), where("isGroup", "==", true), where("members", "array-contains", currentUser.uid));
          groupChatListenerRef.current = onSnapshot(groupChatsQuery, (groupChatsSnapshot) => {
            const groupChats = groupChatsSnapshot.docs.map(doc => ({
              id: doc.id,
              isGroup: true,
              ...doc.data(),
            }));

            // --- Step 3: Combine, sort, and display all chats ---
            const allChats = [...friends, ...groupChats];
            allChats.sort((a, b) => {
              const aIsFav = !a.isGroup && favorites.includes(a.uid);
              const bIsFav = !b.isGroup && favorites.includes(b.uid);
              if (aIsFav && !bIsFav) return -1;
              if (!aIsFav && bIsFav) return 1;
              const aName = a.isGroup ? a.groupName : (a.nickname || a.username);
              const bName = b.isGroup ? b.groupName : (b.nickname || b.username);
              return aName.localeCompare(bName);
            });

            setChats(allChats);
            setLoading(false);

            // --- Unread Message Listeners (for both friends and groups) ---
            const allChatItems = [...friends, ...groupChats];
            const newUnreadListeners = allChatItems.map(chat => {
              const chatId = chat.isGroup ? chat.id : [currentUser.uid, chat.uid].sort().join('_');
              const unreadQuery = query(collection(db, "chats", chatId, "messages"), where("uid", "!=", currentUser.uid), where("isRead", "==", false));
              return onSnapshot(unreadQuery, (unreadSnapshot) => {
                setUnreadChats(prev => ({ ...prev, [chatId]: !unreadSnapshot.empty }));
              });
            });

            // Clean up old listeners and set new ones
            unreadListenersRef.current.forEach(unsub => unsub());
            unreadListenersRef.current = newUnreadListeners;
          });

          // Perform birthday check once friends are loaded
          const today = new Date();
          const todayString = `${today.getMonth() + 1}/${today.getDate()}`;
          const birthdayString = userData.birthday?.substring(0, userData.birthday.lastIndexOf('/'));
          if (todayString === birthdayString) {
            // Use a timeout to prevent the alert from blocking the UI render
            setTimeout(() => Alert.alert("Happy Birthday!", "Hope you celebrate it well!"), 500);
          }

        } else {
          setChats([]);
          setLoading(false);
        }
      });

    return () => {
      // Cleanup function when the component unmounts
      unsubUserData();
      if (groupChatListenerRef.current) groupChatListenerRef.current();
      unreadListenersRef.current.forEach(unsub => unsub());
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078d4" />
      </View>
    );
  }

  const handleToggleFavorite = async () => {
    if (!selectedFriend) return;
    const userRef = doc(db, "users", auth.currentUser.uid);
    if (selectedFriend.isFavorite) {
      await updateDoc(userRef, { favorites: arrayRemove(selectedFriend.uid) });
    } else {
      await updateDoc(userRef, { favorites: arrayUnion(selectedFriend.uid) });
    }
    setOptionsVisible(false);
  };

  const openFriendOptions = (friend) => {
    setSelectedFriend(friend);
    setOptionsVisible(true);
  };

  const openGroupOptions = (group) => {
    setSelectedGroup(group);
  };

  const handleLeaveGroup = async () => {
    if (!selectedGroup) return;
    const groupChatRef = doc(db, "chats", selectedGroup.id);
    try {
      await updateDoc(groupChatRef, {
        members: arrayRemove(user.uid)
      });
      Toast.show({ type: 'info', text1: `You have left ${selectedGroup.groupName}` });
    } catch (error) {
      console.error("Error leaving group:", error);
      Toast.show({ type: 'error', text1: 'Failed to leave group.' });
    } finally {
      setSelectedGroup(null);
    }
  };

  const renderChatItem = ({ item }) => {
    const isGroup = item.isGroup; const chatId = isGroup ? item.id : [user.uid, item.uid].sort().join('_');
    const hasUnread = unreadChats[chatId];

    const handlePress = () => {
      if (isGroup) {
        navigation.navigate("ChatScreen", { chatId: item.id, isGroup: true, groupName: item.groupName, members: item.members || [] });
      } else {
        navigation.navigate("ChatScreen", { friend: item });
      }
    };

    return (
      <TouchableOpacity
        style={[styles.friendButton, { backgroundColor: colors.surface }]}
        onPress={handlePress}
      >
        <View style={styles.friendInfo}>
          <View style={styles.avatarContainer}>
            {isGroup ? (
              <View style={[styles.avatarImage, styles.groupAvatar]}>
                <Text>👥</Text>
              </View>
            ) : (
              <>
                <Image source={ANIMAL_IMAGES[item.profileAnimal?.base || 'capybara']} style={styles.avatarImage} />
                {item.profileAnimal?.hat && item.profileAnimal?.hat !== 'None' && <Image source={HAT_IMAGES[item.profileAnimal.hat]} style={styles.avatarHat} />}
              </>
            )}
          </View>
          <View>
            <Text style={[styles.friendText, { color: colors.text }]}>{isGroup ? item.groupName : (item.nickname || item.username)} {!isGroup && item.isFavorite ? '⭐' : ''}</Text>
            {hasUnread && (
              <View style={styles.newMessageContainer}>
                <View style={styles.newMessageDot} />
                <Text style={styles.newMessageText}>New message</Text>
              </View>
            )}
          </View>
        </View>
        {!isGroup ? (
          <TouchableOpacity style={styles.friendOptions} onPress={() => openFriendOptions(item)}>
            <Text style={styles.friendOptionsText}>...</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.friendOptions} onPress={() => openGroupOptions(item)}>
            <Text style={styles.friendOptionsText}>...</Text>
          </TouchableOpacity>
        ) }
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.homeHeader, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={styles.headerSide}>
          <TouchableOpacity onPress={() => navigation.navigate('AppSettingsScreen')}>
            <Text style={[styles.headerButton, { fontSize: 24 }]}>⚙️</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.headerCenter}>
          <Text style={[styles.homeTitle, { color: colors.text }]}>Chats</Text>
        </View>
        <View style={[styles.headerSide, { flexDirection: 'row', justifyContent: 'flex-end' }]}>
          <TouchableOpacity onPress={() => navigation.navigate('AddFriendsScreen')}>
            <Text style={[styles.headerButton, { fontSize: 28, marginRight: 15 }]}>+</Text>
          </TouchableOpacity>
        </View>
      </View>
      <View style={styles.content}>
        <FlatList
          data={chats}
          keyExtractor={(item) => item.id || item.uid}
          renderItem={renderChatItem}
          contentContainerStyle={{ marginTop: 16 }}
          ListEmptyComponent={<Text style={{ color: colors.subtext, textAlign: 'center' }}>No chats found. Add friends to get started!</Text>}
        />
      </View>
      {/* Floating Action Button for New Group */}
      <View style={styles.fabContainer}>
        <TouchableOpacity style={styles.fab} onPress={() => navigation.navigate('CreateGroupScreen')}>
          <Text style={styles.fabIcon}>👥</Text>
        </TouchableOpacity>
      </View>
      {/* Pass navigation to Navbar */}
      <Navbar navigation={navigation} />

      <Modal visible={optionsVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
          <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]} onPress={handleToggleFavorite}>
              <Text style={[styles.optionText, { color: colors.text }]}>{selectedFriend?.isFavorite ? 'Unfavorite' : 'Favorite'}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]}>
              <Text style={[styles.optionText, { color: colors.text }]}>Mute Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomWidth: 0 }]} onPress={() => setOptionsVisible(false)}>
              <Text style={[styles.optionText, { color: 'red' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={!!selectedGroup} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedGroup(null)}>
          <View style={[styles.optionsContainer, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]}>
              <Text style={[styles.optionText, { color: colors.text }]}>Mute Notifications</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomColor: colors.border }]} onPress={handleLeaveGroup}>
              <Text style={[styles.optionText, { color: 'red' }]}>Leave Groupchat</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, { borderBottomWidth: 0 }]} onPress={() => setSelectedGroup(null)}>
              <Text style={[styles.optionText, { color: 'red' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  homeHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 15, paddingTop: 60, paddingBottom: 15, borderBottomWidth: 1 },
  headerSide: { flex: 1 },
  headerCenter: { flex: 2, alignItems: 'center' },
  homeTitle: { fontSize: 22, fontWeight: 'bold' },
  headerButton: { fontSize: 16, color: '#0078d4' },
  content: { flex: 1, padding: 10 },
  friendButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
    elevation: 2,
  },
  friendText: { fontSize: 16, fontWeight: "600" },
  friendInfo: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    marginRight: 15,
    position: 'relative',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  groupAvatar: {
    backgroundColor: '#e0e0e0',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarHat: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    top: -26,
    left: -0.75,
    resizeMode: 'contain',
  },
  newMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  newMessageDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#0078d4',
    marginRight: 6,
  },
  newMessageText: {
    color: '#0078d4',
    fontSize: 12,
    fontWeight: 'bold',
  },
  friendOptions: { padding: 5 },
  friendOptionsText: { fontSize: 20, fontWeight: 'bold', color: '#ccc' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  optionsContainer: {
    width: '80%',
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
  fabContainer: {
    position: 'absolute',
    right: 20,
    bottom: 130, // Positioned above the Navbar
    zIndex: 10,
  },
  fab: {
    backgroundColor: '#0078d4',
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8, // Shadow for Android
  },
  fabIcon: {
    fontSize: 28,
    color: 'white',
  },
});
