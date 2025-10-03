// screens/ChatListScreen.js
import React, { useEffect, useState } from "react";
import { View, Text, FlatList, TouchableOpacity, Modal, StyleSheet, ActivityIndicator } from "react-native";
import Toast from "react-native-toast-message";
import SupabaseService from "../services/SupabaseService";
import { supabase } from "../supabase";

export default function ChatListScreen({ navigation }) {
  const [friends, setFriends] = useState([]);
  const [selectedFriend, setSelectedFriend] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let subscription;
    const load = async () => {
      try {
        const user = await SupabaseService.getCurrentUser();
        if (!user) {
          setLoading(false);
          return;
        }
        setCurrentUser(user);

        const { data: userData } = await SupabaseService.getUserProfile(user.id);
        const friendIds = userData?.friends || [];
        const nicknames = userData?.nicknames || {};

        let friendsData = [];
        if (friendIds.length) {
          const { data: rows } = await supabase
            .from('users')
            .select('*')
            .in('id', friendIds);
          friendsData = (rows || []).map(row => ({
            uid: row.id,
            username: row.username,
            email: row.email,
            nickname: nicknames[row.id],
          }));
        }
        setFriends(friendsData);

        // Subscribe to changes on current user's profile for live updates
        subscription = supabase
          .channel(`users:${user.id}`)
          .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'users',
            filter: `id=eq.${user.id}`,
          }, async (payload) => {
            const newData = payload.new;
            const friendIds = newData?.friends || [];
            const nicknames = newData?.nicknames || {};
            if (friendIds.length) {
              const { data: rows } = await supabase
                .from('users')
                .select('*')
                .in('id', friendIds);
              const friendsData = (rows || []).map(row => ({
                uid: row.id,
                username: row.username,
                email: row.email,
                nickname: nicknames[row.id],
              }));
              setFriends(friendsData);
            } else {
              setFriends([]);
            }
          })
          .subscribe();
      } catch (err) {
        console.error(err);
        Toast.show({ type: 'error', text1: 'Failed to load friends', text2: err.message });
      } finally {
        setLoading(false);
      }
    };
    load();
    return () => { subscription?.unsubscribe?.(); };
  }, []);

  const openChat = (friend) => {
    navigation.navigate('ChatScreen', { friend });
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerButton}>
          <Text>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('AddFriendsScreen')} style={styles.headerButton}>
          <Text>Add Friends</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => navigation.navigate('AppSettingsScreen')} style={styles.headerButton}>
          <Text>Settings</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={friends}
        keyExtractor={(item) => item.uid}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.friendBox} onPress={() => openChat(item)}>
            <Text>{item.nickname || item.username || item.email}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{ textAlign: 'center', marginTop: 20 }}>No friends yet</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f7f7f7" },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: "row", justifyContent: "space-around", padding: 16, backgroundColor: "#e0f7fa" },
  headerButton: { padding: 8, backgroundColor: "#b6eaff", borderRadius: 8 },
  friendBox: { padding: 16, margin: 8, backgroundColor: "#fff", borderRadius: 12, shadowColor: "#000", shadowOpacity: 0.1, shadowOffset: { width: 0, height: 2 }, shadowRadius: 4, elevation: 2 },
});
