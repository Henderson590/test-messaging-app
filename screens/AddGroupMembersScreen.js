// screens/AddGroupMembersScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';
import { ANIMAL_IMAGES } from '../assets/images';
import Toast from 'react-native-toast-message';

export default function AddGroupMembersScreen({ route, navigation }) {
  const { chatId, currentMembers } = route.params;
  const { colors } = useTheme();
  const [friends, setFriends] = useState([]);
  const [selectedFriends, setSelectedFriends] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchFriends = async () => {
      if (!auth.currentUser) return;
      const userDoc = await getDocs(query(collection(db, 'users'), where('__name__', '==', auth.currentUser.uid)));
      const userData = userDoc.docs[0]?.data();
      const friendIds = userData?.friends || [];

      // Filter out friends who are already members
      const availableFriendIds = friendIds.filter(id => !currentMembers.includes(id));

      if (availableFriendIds.length > 0) {
        const friendsQuery = query(collection(db, 'users'), where('__name__', 'in', availableFriendIds));
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
  }, [currentMembers]);

  const toggleFriendSelection = (friend) => {
    setSelectedFriends(prev =>
      prev.some(f => f.uid === friend.uid)
        ? prev.filter(f => f.uid !== friend.uid)
        : [...prev, friend]
    );
  };

  const handleAddMembers = async () => {
    if (selectedFriends.length === 0) {
      return Toast.show({ type: 'error', text1: 'Please select at least one friend to add.' });
    }

    const newMemberIds = selectedFriends.map(f => f.uid);
    const groupChatRef = doc(db, "chats", chatId);

    try {
      await updateDoc(groupChatRef, {
        members: arrayUnion(...newMemberIds)
      });
      Toast.show({ type: 'success', text1: 'Members added successfully!' });
      navigation.goBack();
    } catch (error) {
      console.error("Error adding members:", error);
      Toast.show({ type: 'error', text1: 'Failed to add members.' });
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
        <Text style={[styles.headerTitle, { color: colors.text }]}>Add Members</Text>
      </View>
      {loading ? <ActivityIndicator /> : (
        <FlatList
          data={friends}
          renderItem={renderFriendItem}
          keyExtractor={item => item.uid}
          ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20, color: colors.subtext }}>All your friends are already in this group.</Text>}
        />
      )}
      <TouchableOpacity style={styles.createButton} onPress={handleAddMembers}>
        <Text style={styles.createButtonText}>Add Members ({selectedFriends.length})</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingTop: 60, paddingBottom: 20, paddingHorizontal: 15, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  headerButton: { fontSize: 16, color: '#0078d4' },
  friendItem: { flexDirection: 'row', alignItems: 'center', padding: 15, marginHorizontal: 15, marginTop: 10, borderRadius: 12, borderWidth: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, marginRight: 15 },
  friendName: { flex: 1, fontSize: 16, fontWeight: '600' },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: '#0078d4', justifyContent: 'center', alignItems: 'center' },
  checkmark: { color: 'white', fontWeight: 'bold' },
  createButton: { backgroundColor: '#0078d4', padding: 20, margin: 20, borderRadius: 12, alignItems: 'center' },
  createButtonText: { color: 'white', fontSize: 16, fontWeight: 'bold' },
});