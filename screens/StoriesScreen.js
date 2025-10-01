// screens/StoriesScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, Image, ActivityIndicator } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { db, auth } from '../firebase';
import { collection, query, where, onSnapshot, getDoc, doc, Timestamp } from 'firebase/firestore';
import { useTheme } from '../contexts/ThemeContext';
import { ANIMAL_IMAGES, HAT_IMAGES } from '../assets/images';

export default function StoriesScreen({ navigation }) {
  const { colors } = useTheme();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState([]);

  useFocusEffect(
    React.useCallback(() => {
      if (!auth.currentUser) return;

      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      const unsub = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          setFriends(docSnap.data().friends || []);
        }
      });

      return () => unsub();
    }, [])
  );

  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const uidsToQuery = [...new Set([auth.currentUser.uid, ...friends])];

    if (uidsToQuery.length === 0) {
      setLoading(false);
      return;
    }

    const twelveHoursAgo = Timestamp.fromMillis(Date.now() - 12 * 60 * 60 * 1000);
    const storiesQuery = query(
      collection(db, 'stories'),
      where('uid', 'in', uidsToQuery),
      where('createdAt', '>=', twelveHoursAgo)
    );

    const unsubscribe = onSnapshot(storiesQuery, (snapshot) => {
      const storiesByUId = {};
      snapshot.docs.forEach(doc => {
        const story = { id: doc.id, ...doc.data() };
        if (!storiesByUId[story.uid]) {
          storiesByUId[story.uid] = {
            uid: story.uid,
            username: story.username,
            profileAnimal: story.profileAnimal,
            stories: [],
          };
        }
        storiesByUId[story.uid].stories.push(story);
      });

      const groupedStories = Object.values(storiesByUId);

      // Sort to show the current user's story first
      groupedStories.sort((a, b) => {
        if (a.uid === auth.currentUser.uid) return -1;
        if (b.uid === auth.currentUser.uid) return 1;
        return 0;
      });

      setStories(groupedStories);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [friends]);

  const renderStoryGroup = ({ item }) => (
    <TouchableOpacity
      style={styles.storyCircleContainer}
      onPress={() => navigation.navigate('StoryViewerScreen', { storyGroup: item })}
    >
      <View style={[styles.storyCircle, item.uid === auth.currentUser.uid && styles.myStoryCircle]}>
        <Image source={ANIMAL_IMAGES[item.profileAnimal?.base || 'capybara']} style={styles.storyAvatar} />
      </View>
      <Text style={[styles.username, { color: colors.text }]}>{item.uid === auth.currentUser.uid ? 'Your Story' : item.username}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Stories</Text>
        <TouchableOpacity onPress={() => navigation.navigate('CreateStoryScreen')}>
          <Text style={styles.addButton}>+</Text>
        </TouchableOpacity>
      </View>
      {loading ? (
        <ActivityIndicator style={{ marginTop: 20 }} color="#0078d4" />
      ) : (
        <FlatList
          data={stories}
          renderItem={renderStoryGroup}
          keyExtractor={(item) => item.uid}
          ListEmptyComponent={<Text style={[styles.emptyText, { color: colors.subtext }]}>No new stories from your friends.</Text>}
          contentContainerStyle={styles.listContainer}
        />
      )}
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
  headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 2, textAlign: 'center', paddingBottom: 10 },
  addButton: { fontSize: 30, color: '#0078d4', paddingBottom: 1, flex: 1, textAlign: 'right' },
  listContainer: { padding: 10 },
  storyCircleContainer: {
    alignItems: 'center',
    margin: 10,
  },
  storyCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#0078d4',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 5,
  },
  myStoryCircle: {
    borderColor: '#888', // Differentiate the user's own story circle
  },
  storyAvatar: {
    width: '100%',
    height: '100%',
    borderRadius: 35,
  },
  username: {
    marginTop: 5,
    fontSize: 12,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 50,
    fontSize: 16,
  },
});