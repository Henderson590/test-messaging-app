// screens/CreateGroupScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';
import { ANIMAL_IMAGES } from '../assets/images';
import Toast from 'react-native-toast-message';

export default function CreateGroupScreen({ navigation }) {
  const { colors } = useTheme();
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!auth.currentUser) return;
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', auth.currentUser.uid)));
      const userData = userDoc.docs[0]?.data();
      const friendIds = userData?.friends || [];

      if (friendIds.length > 0) {
        const friendsQuery = query(collection(db, 'users'), where('__name__', 'in', friendIds));
        const friendsSnapshot = await getDocs(friendsQuery);
        const friendsList = friendsSnapshot.docs.map(doc => ({
          uid: doc.id,
          ...doc.data(),
        }));
        setFriends(friendsList);
      }
      setLoading(false);
    };

    fetchFriends();
  }, []);

  const toggleFriendSelection = (friend) => {
    setSelectedFriends(prev =>
      prev.some(f => f.uid === friend.uid)
        ? prev.filter(f => f.uid !== friend.uid)
        : [...prev, friend]
    );
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim()) {
      return Toast.show({ type: 'error', text1: 'Please enter a group name.' });
    }
    if (selectedFriends.length === 0) {
      return Toast.show({ type: 'error', text1: 'Please select at least one friend.' });
    }

    const members = [auth.currentUser.uid, ...selectedFriends.map(f => f.uid)];

    try {
      const groupChatRef = await addDoc(collection(db, 'chats'), {
        groupName: groupName.trim(),
        members: members,
        admins: [auth.currentUser.uid],
        isGroup: true,
        createdAt: serverTimestamp(),
        createdBy: auth.currentUser.uid,
      });

      navigation.navigate('ChatScreen', {
        chatId: groupChatRef.id,
        isGroup: true,
        groupName: groupName.trim(),
      });
      navigation.goBack(); // Go back to ensure HomeScreen re-renders
    } catch (error) {
      console.error("Error creating group chat:", error);
      Toast.show({ type: 'error', text1: 'Failed to create group.' });
    }
  };

  const renderFriendItem = ({ item }) => {
    const isSelected = selectedFriends.some(f => f.uid === item.uid);
    return (
      <TouchableOpacity
        style={[styles.friendItem, { backgroundColor: colors.surface, borderColor: isSelected ? '#0078d4' : colors.border }]}
        onPress={() => toggleFriendSelection(item)}
      >
        <Image source={ANIMAL_IMAGES[item.profileAnimal?.base || 'capybara']} style={styles.avatar} />
        <Text style={[styles.friendName, { color: colors.text }]}>{item.username}</Text>
        <View style={[styles.checkbox, { backgroundColor: isSelected ? '#0078d4' : colors.background }]}>
          {isSelected && <Text style={styles.checkmark}>✓</Text>}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.headerButton}>Cancel</Text></TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>New Group</Text>
      </View>
      <TextInput
        style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border }]}
        placeholder="Group Name"
        value={groupName}
        onChangeText={setGroupName}
      />
      {loading ? <ActivityIndicator /> : (
        <FlatList
          data={friends}
          renderItem={renderFriendItem}
          keyExtractor={item => item.uid}
          ListHeaderComponent={<Text style={[styles.subHeader, { color: colors.subtext }]}>Select Friends</Text>}
        />
      )}
      <TouchableOpacity style={styles.createButton} onPress={handleCreateGroup}>
        <Text style={styles.createButtonText}>Create Group ({selectedFriends.length})</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 15, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerButton: { fontSize: 16, color: '#0078d4' },
  input: { height: 50, borderWidth: 1, borderRadius: 10, paddingHorizontal: 15, margin: 15, fontSize: 16 },
  subHeader: { fontSize: 16, fontWeight: '600', paddingHorizontal: 15, marginBottom: 10 },
  friendItem: { flexDirection: 'row', alignItems: 'center', padding: 15, marginHorizontal: 15, marginBottom: 10, borderRadius: 12, borderWidth: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15 },
  friendName: { flex: 1, fontSize: 16, fontWeight: '600' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#0078d4', justifyContent: 'center', alignItems: 'center' },
  checkmark: { color: 'white', fontWeight: 'bold' },
  createButton: { backgroundColor: '#0078d4', padding: 20, margin: 20, borderRadius: 12, alignItems: 'center' },
  createButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});