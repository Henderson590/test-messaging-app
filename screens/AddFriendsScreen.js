// screens/AddFriendsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert } from 'react-native';
import { db, auth } from '../firebase';
import { collection, query, where, getDocs, doc, updateDoc, arrayUnion, onSnapshot, arrayRemove } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';

export default function AddFriendsScreen({ navigation }) {
  const [searchUsername, setSearchUsername] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const { colors } = useTheme();

  // Listener for incoming friend requests
  useEffect(() => {
    if (!auth.currentUser) return;
    const userDocRef = doc(db, "users", auth.currentUser.uid);
    const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
      if (docSnap.exists()) {
        setRequests(docSnap.data().pendingRequests || []);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSearch = async () => {
    if (!searchUsername.trim()) return;
    setLoading(true);
    try {
      const q = query(collection(db, "users"), where("username", "==", searchUsername.trim()));
      const querySnapshot = await getDocs(q);
      const users = querySnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(user => user.id !== auth.currentUser.uid); // Exclude self
      setSearchResults(users);
    } catch (err) {
      console.error("Search error:", err);
      Toast.show({ type: 'error', text1: 'Failed to search for users.' });
    } finally {
      setLoading(false);
    }
  };

  const sendFriendRequest = async (targetUser) => {
    const currentUserDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
    const currentUsername = currentUserDoc.data().username;

    const targetUserRef = doc(db, "users", targetUser.id);
    await updateDoc(targetUserRef, {
      pendingRequests: arrayUnion({
        fromUid: auth.currentUser.uid,
        fromUsername: currentUsername,
      }),
    });
    Toast.show({ type: 'success', text1: `Friend request sent to ${targetUser.username}!` });
  };

  const acceptRequest = async (request) => {
    const currentUserRef = doc(db, "users", auth.currentUser.uid);
    const friendRef = doc(db, "users", request.fromUid);
    await updateDoc(currentUserRef, {
      friends: arrayUnion(request.fromUid),
      pendingRequests: arrayRemove(request),
    });
    await updateDoc(friendRef, { friends: arrayUnion(auth.currentUser.uid) });
    Toast.show({ type: 'success', text1: 'Friend request accepted!' });
  };

  const denyRequest = async (request) => {
    const currentUserRef = doc(db, "users", auth.currentUser.uid);
    await updateDoc(currentUserRef, { pendingRequests: arrayRemove(request) });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Add Friends</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text }]}
          placeholder="Search by username"
          value={searchUsername}
          onChangeText={setSearchUsername}
          autoCapitalize="none"
        />
        <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
          <Text style={styles.searchButtonText}>Search</Text>
        </TouchableOpacity>
      </View>

      {loading && <ActivityIndicator style={{ marginTop: 20 }} />}
      <FlatList
        data={searchResults}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={[styles.userItem, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
            <Text style={[styles.username, { color: colors.text }]}>{item.username}</Text>
            <TouchableOpacity style={styles.addButton} onPress={() => sendFriendRequest(item)}>
              <Text style={styles.addButtonText}>Add</Text>
            </TouchableOpacity>
          </View>
        )}
        ListEmptyComponent={!loading && searchUsername ? <Text style={styles.noResults}>No users found.</Text> : null}
      />

      <View style={styles.requestsContainer}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Friend Requests</Text>
        <FlatList
          data={requests}
          keyExtractor={(item) => item.fromUid}
          renderItem={({ item }) => (
            <View style={[styles.requestItem, { backgroundColor: colors.surface }]}>
              <Text style={[styles.username, { color: colors.text }]}>{item.fromUsername}</Text>
              <View style={styles.requestActions}>
                <TouchableOpacity style={[styles.requestButton, styles.acceptButton]} onPress={() => acceptRequest(item)}>
                  <Text style={styles.requestButtonText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.requestButton, styles.denyButton]} onPress={() => denyRequest(item)}>
                  <Text style={styles.requestButtonText}>Deny</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.noResults, { color: colors.subtext }]}>No pending requests.</Text>}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', paddingHorizontal: 15, paddingTop: 60, paddingBottom: 20, borderBottomWidth: 1 }, // Already correct
    backArrow: { fontSize: 16, color: '#0078d4', paddingBottom: 2, flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 2, textAlign: 'center' },
    searchContainer: { flexDirection: 'row', padding: 10, alignItems: 'center' },
    input: { flex: 1, height: 44, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10 },
    searchButton: { backgroundColor: '#0078d4', paddingHorizontal: 15, height: 44, justifyContent: 'center', borderRadius: 8, marginLeft: 10 },
    searchButtonText: { color: '#fff', fontWeight: 'bold' },
    userItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderBottomWidth: 1 },
    username: { fontSize: 16 },
    addButton: { backgroundColor: '#28a745', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 6 },
    addButtonText: { color: '#fff' },
    noResults: { textAlign: 'center', marginTop: 20 },
    requestsContainer: { flex: 1, padding: 10, marginTop: 20 },
    sectionTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
    requestItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, borderRadius: 8, marginBottom: 10 },
    requestActions: { flexDirection: 'row', gap: 10 },
    requestButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6 },
    acceptButton: { backgroundColor: '#0078d4' },
    denyButton: { backgroundColor: '#dc3545' },
    requestButtonText: { color: '#fff' },
});