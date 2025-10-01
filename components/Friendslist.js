// components/FriendsList.js
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from "react-native";
import { db, auth } from "../firebase";
import { collection, getDocs } from "firebase/firestore";
import { useNavigation } from "@react-navigation/native";

export default function FriendsList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const usersRef = collection(db, "users");
        const snapshot = await getDocs(usersRef);
        const userList = snapshot.docs
          .map(doc => ({ uid: doc.id, ...doc.data() }))
          .filter(u => u.uid !== auth.currentUser.uid);
        setUsers(userList);
      } catch (e) {
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const startChat = (friend) => {
    // Compose chatId
    const myUid = auth.currentUser.uid;
    const chatId = myUid > friend.uid ? `${friend.uid}_${myUid}` : `${myUid}_${friend.uid}`;

    navigation.navigate("ChatScreen", { chatId, friend });
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.userCard} onPress={() => startChat(item)}>
      <Text style={styles.username}>{item.username || item.email || "Unknown User"}</Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0078d4" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {users.length === 0 ? (
        <Text style={styles.noUsers}>No other users found.</Text>
      ) : (
        <FlatList
          data={users}
          keyExtractor={(item) => item.uid}
          renderItem={renderItem}
          contentContainerStyle={{ padding: 12 }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  userCard: {
    padding: 14,
    marginVertical: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  username: { fontSize: 16, fontWeight: "500", color: "#222" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  noUsers: { textAlign: "center", marginTop: 20, fontSize: 16, color: "#888" },
});
