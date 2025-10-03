// HomeScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, FlatList, TouchableOpacity, Alert, Modal, Pressable, Image } from "react-native";
import { supabase } from "../supabase";
import SupabaseService from "../services/SupabaseService";
import Navbar from "../components/Navbar";
import { useTheme } from "../contexts/ThemeContext";
import { ANIMAL_IMAGES, HAT_IMAGES } from "../assets/images";
import Toast from "react-native-toast-message";

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

  useEffect(() => {
    const initializeData = async () => {
      try {
        const currentUser = await SupabaseService.getCurrentUser();
        if (!currentUser) {
          setLoading(false);
          return;
        }
        
        setUser(currentUser);
        
        // Get user profile data
        const { data: userData } = await SupabaseService.getUserProfile(currentUser.id);
        if (userData) {
          const nicknames = userData.nicknames || {};
          const favorites = userData.favorites || [];
          const friendIds = userData.friends || [];
          
          // Fetch friends data
          let friends = [];
          if (friendIds.length > 0) {
            // Get friends' profiles
            const { data: friendsData } = await supabase
              .from('users')
              .select('*')
              .in('id', friendIds);
            
            if (friendsData) {
              friends = friendsData.map((friendDoc) => ({
                uid: friendDoc.id,
                isGroup: false,
                ...friendDoc,
                nickname: nicknames[friendDoc.id],
                isFavorite: favorites.includes(friendDoc.id),
              }));
            }
          }
          
          // Get group chats
          const { data: groupChats } = await supabase
            .from('chats')
            .select('*')
            .eq('is_group', true)
            .contains('participants', [currentUser.id]);
            
          const groups = (groupChats || []).map(doc => ({
            id: doc.id,
            isGroup: true,
            ...doc,
            groupName: doc.group_name,
            members: doc.participants
          }));
          
          // Combine and sort chats
          const allChats = [...friends, ...groups];
          allChats.sort((a, b) => {
            const aIsFav = !a.isGroup && favorites.includes(a.uid);
            const bIsFav = !b.isGroup && favorites.includes(b.uid);
            if (aIsFav && !bIsFav) return -1;
            if (!aIsFav && bIsFav) return 1;
            const aName = a.isGroup ? a.groupName : (a.nickname || a.username);
            const bName = b.isGroup ? b.groupName : (b.nickname || b.username);
            return (aName || '').localeCompare(bName || '');
          });
          
          setChats(allChats);
          
          // Check for birthday
          const today = new Date();
          const todayString = `${today.getMonth() + 1}/${today.getDate()}`;
          const birthdayString = userData.birthday?.substring(0, userData.birthday.lastIndexOf('/'));
          if (todayString === birthdayString) {
            setTimeout(() => Alert.alert("Happy Birthday!", "Hope you celebrate it well!"), 500);
          }
        }
      } catch (error) {
        console.error("Error initializing data:", error);
        Toast.show({ type: "error", text1: "Error loading data", text2: error.message });
      } finally {
        setLoading(false);
      }
    };
    
    initializeData();
  }, []);

  const renderChatItem = ({ item }) => {
    const isGroup = item.isGroup;
    const chatId = isGroup ? item.id : [user?.id, item.uid].sort().join('_');
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
          <View style={styles.textContainer}>
            <Text style={[styles.friendName, { color: colors.text }]}>
              {isGroup ? item.groupName : (item.nickname || item.username)}
              {item.isFavorite && <Text style={styles.star}> ⭐</Text>}
              {item.isBirthday && <Text style={styles.birthday}> 🎂</Text>}
            </Text>
            <Text style={[styles.friendEmail, { color: colors.subtext }]}>
              {isGroup ? `${item.members?.length || 0} members` : item.email}
            </Text>
          </View>
          {hasUnread && <View style={styles.unreadDot} />}
        </View>
        {!isGroup && (
          <TouchableOpacity 
            style={styles.optionsButton} 
            onPress={(e) => {
              e.stopPropagation();
              openFriendOptions(item);
            }}
          >
            <Text style={styles.optionsText}>⋯</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  const handleAddFriends = () => {
    navigation.navigate("AddFriendsScreen");
  };

  const handleCreateGroup = () => {
    navigation.navigate("CreateGroupScreen");
  };

  const handleSettings = () => {
    navigation.navigate("AppSettingsScreen");
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078d4" />
      </View>
    );
  }

  const handleToggleFavorite = async () => {
    if (!selectedFriend) return;
    const currentUser = await SupabaseService.getCurrentUser();
    if (!currentUser) return;
    
    try {
      const { data: userData } = await SupabaseService.getUserProfile(currentUser.id);
      let favorites = userData?.favorites || [];
      
      if (selectedFriend.isFavorite) {
        favorites = favorites.filter(id => id !== selectedFriend.uid);
      } else {
        favorites = [...favorites, selectedFriend.uid];
      }
      
      await SupabaseService.updateUserProfile(currentUser.id, { favorites });
      setOptionsVisible(false);
    } catch (error) {
      console.error('Error toggling favorite:', error);
      Toast.show({ type: 'error', text1: 'Failed to update favorite' });
    }
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
    const currentUser = await SupabaseService.getCurrentUser();
    if (!currentUser) return;
    
    try {
      await SupabaseService.leaveGroup(selectedGroup.id, currentUser.id);
      Toast.show({ type: 'info', text1: `You have left ${selectedGroup.groupName}` });
    } catch (error) {
      console.error("Error leaving group:", error);
      Toast.show({ type: 'error', text1: 'Failed to leave group.' });
    } finally {
      setSelectedGroup(null);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.topHeader, { borderBottomColor: colors.border }] }>
        <TouchableOpacity onPress={() => navigation.navigate('AppSettingsScreen')} style={styles.headerSide}>
          <Text style={styles.headerIcon}>⚙️</Text>
        </TouchableOpacity>
        <Text style={[styles.headerCenterTitle, { color: colors.text }]}>Chats</Text>
        <TouchableOpacity onPress={() => navigation.navigate('AddFriendsScreen')} style={styles.headerSide}>
          <Text style={styles.headerIcon}>＋</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={chats}
        renderItem={renderChatItem}
        keyExtractor={(item) => item.isGroup ? item.id : item.uid}
        style={styles.friendsList}
        contentContainerStyle={{ paddingTop: 70, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      />

      {/* Floating Group Button */}
      <TouchableOpacity style={styles.fabGroup} onPress={() => navigation.navigate('CreateGroupScreen')}>
        <Text style={{ fontSize: 24 }}>👥</Text>
      </TouchableOpacity>

      <Navbar 
        onStories={() => navigation.navigate("StoriesScreen")}
        onCamera={() => navigation.navigate("CameraScreen")}
        onProfile={() => navigation.navigate("UserProfileScreen")}
      />
      
      {/* Friend Options Modal */}
      <Modal
        visible={optionsVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setOptionsVisible(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <TouchableOpacity style={styles.modalOption} onPress={handleToggleFavorite}>
              <Text style={[styles.modalOptionText, { color: colors.text }]}>
                {selectedFriend?.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.modalOption} 
              onPress={() => {
                setOptionsVisible(false);
                if (selectedFriend) {
                  navigation.navigate('FriendProfileScreen', { friend: selectedFriend });
                }
              }}
            >
              <Text style={[styles.modalOptionText, { color: colors.text }]}>View Profile</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={styles.modalOption} onPress={() => setOptionsVisible(false)}>
              <Text style={[styles.modalOptionText, { color: '#ff4d4d' }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
      
      <Toast />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: "center",
    alignItems: "center",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
  },
  settingsButton: {
    padding: 5,
  },
  settingsIcon: {
    fontSize: 20,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    padding: 20,
  },
  topHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 60,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 8,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  headerSide: { width: 48, height: 36, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 22 },
  headerCenterTitle: { fontSize: 20, fontWeight: '700' },
  fabGroup: {
    position: 'absolute',
    right: 20,
    bottom: 140,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
    zIndex: 20,
  },
  actionButton: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
  },
  actionButtonText: {
    color: "white",
    fontWeight: "600",
    fontSize: 16,
  },
  chatsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 15,
  },
  chatsList: {
    flex: 1,
  },
  chatButton: {
    padding: 15,
    marginBottom: 10,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  lastMessage: {
    fontSize: 14,
    opacity: 0.7,
  },
  loadingText: {
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: "center",
    marginTop: 50,
  },
});