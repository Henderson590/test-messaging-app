// screens/StoryViewerScreen.js
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, TextInput, SafeAreaView, Alert, ActivityIndicator, Modal, Pressable } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc, deleteDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { Video } from 'expo-av';

export default function StoryViewerScreen({ route, navigation }) {
  const { storyGroup: initialStoryGroup } = route.params;
  const { colors } = useTheme();
  const [storyGroup, setStoryGroup] = useState(initialStoryGroup);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [replyText, setReplyText] = useState('');
  const [optionsVisible, setOptionsVisible] = useState(false);
  const timerRef = useRef(null);

  const isMyStory = storyGroup.uid === auth.currentUser.uid;
  const currentStory = storyGroup.stories?.[currentIndex];

  const videoRef = useRef(null);

  useEffect(() => {
    if (currentStory && currentStory.mediaType !== 'video') {
      timerRef.current = setTimeout(() => {
        handleNext();
      }, 5000); // 5 seconds for images
    }

    return () => clearTimeout(timerRef.current);
  }, [currentIndex, currentStory]);

  const onPlaybackStatusUpdate = (status) => {
    if (status.didJustFinish) {
      handleNext();
    }
  };

  const handleNext = () => {
    if (currentIndex < storyGroup.stories.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      navigation.goBack(); // Go back after the last story
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSendReply = async (text) => {
    if (!text.trim()) return;

    const myUid = auth.currentUser.uid;
    const friendUid = storyGroup.uid;
    const chatId = [myUid, friendUid].sort().join('_');

    try {
      const displayName = auth.currentUser.displayName || (await getDoc(doc(db, "users", myUid))).data()?.username || "Anonymous";

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        text: text,
        uid: myUid,
        displayName,
        isRead: false,
        createdAt: serverTimestamp(),
        isStoryReply: true,
        story: {
          imageUrl: currentStory.imageUrl,
          storyId: currentStory.id,
        },
      });

      Toast.show({ type: 'success', text1: 'Reply sent!' });
      setReplyText('');
    } catch (error) {
      console.error("Error sending reply:", error);
      Toast.show({ type: 'error', text1: 'Failed to send reply.' });
    }
  };

  const handleDeleteStory = () => {
    Alert.alert(
      "Delete Story",
      "Are you sure you want to delete this story? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteDoc(doc(db, 'stories', currentStory.id));
              Toast.show({ type: 'info', text1: 'Story deleted.' });

              // Remove the story from the local state to force an immediate UI update
              const updatedStories = storyGroup.stories.filter(s => s.id !== currentStory.id);
              setStoryGroup({ ...storyGroup, stories: updatedStories });

              if (updatedStories.length > 0) {
                // If we deleted a story that wasn't the last one, the next one slides into the current index.
                // We just need to stay at the current index, which will now show a new story.
                // If we deleted the last one, we need to go to the new last one.
                setCurrentIndex(Math.min(currentIndex, updatedStories.length - 1));
              } else {
                navigation.goBack();
              }
            } catch (error) {
              Toast.show({ type: 'error', text1: 'Failed to delete story.' });
            }
          },
        },
      ]
    );
  };

  const formatTimeAgo = (timestamp) => {
    if (!timestamp) return '';
    const now = Date.now();
    const storyTime = timestamp.toMillis();
    const seconds = Math.floor((now - storyTime) / 1000);

    if (seconds < 60) {
      return 'just now';
    }
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes}m ago`;
    }
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return `${hours}h ago`;
    }
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  if (!currentStory) {
    // This can happen briefly after a story is deleted
    return <ActivityIndicator style={{ flex: 1, backgroundColor: '#000' }} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.progressContainer}>
        {storyGroup.stories.map((_, index) => (
          <View key={index} style={[styles.progressBar, { backgroundColor: index <= currentIndex ? '#fff' : '#888' }]} />
        ))}
      </View>
      {currentStory.mediaType === 'video' ? (
        <Video
          ref={videoRef}
          source={{ uri: currentStory.imageUrl }}
          style={styles.storyImage}
          shouldPlay
          resizeMode="contain"
          onPlaybackStatusUpdate={onPlaybackStatusUpdate}
        />
      ) : (
        <Image source={{ uri: currentStory.imageUrl }} style={styles.storyImage} />
      )}
      <View style={styles.overlay}>
        <View style={styles.header}>
          <View>
            <Text style={styles.username}>{storyGroup.username}</Text>
            <Text style={styles.timeAgo}>{formatTimeAgo(currentStory.createdAt)}</Text>
          </View>
          <View style={styles.headerControls}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
          </View>
        </View>
        <View style={styles.tapZones}>
          <TouchableOpacity style={styles.tapZone} onPress={handlePrev} />
          <TouchableOpacity style={styles.tapZone} onPress={handleNext} /> 
        </View>
        {isMyStory ? (
          <View style={styles.footer}>
            <TouchableOpacity style={styles.optionsTriggerButton} onPress={() => setOptionsVisible(true)}>
              <Text style={styles.optionsTriggerText}>...</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.footer}>
            <TextInput
              style={styles.replyInput}
              placeholder={`Reply to ${storyGroup.username}...`}
              placeholderTextColor="#ccc"
              value={replyText}
              onChangeText={setReplyText}
              onSubmitEditing={() => handleSendReply(replyText)}
            />
            <TouchableOpacity onPress={() => handleSendReply('❤️')}>
              <Text style={styles.emoji}>❤️</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleSendReply('😂')}>
              <Text style={styles.emoji}>😂</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
      <Modal visible={optionsVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setOptionsVisible(false)}>
          <TouchableOpacity style={styles.modalButton} onPress={() => { setOptionsVisible(false); handleDeleteStory(); }}>
            <Text style={[styles.modalButtonText, { color: 'red' }]}>Delete Post</Text>
          </TouchableOpacity>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  storyImage: { width: '100%', height: '100%', resizeMode: 'contain' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  progressContainer: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    gap: 4,
    zIndex: 10,
  },
  progressBar: { flex: 1, height: 3, borderRadius: 2, paddingTop: 5, marginTop: 30 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    marginTop: 40, // Lowered the header
  },
  headerControls: {
    flexDirection: 'row',
    alignItems: 'flex-end', // Align with the header style
  },
  username: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  timeAgo: { color: '#ccc', fontSize: 12 },
  closeButton: { color: '#fff', fontSize: 32 },
  deleteButton: { color: '#fff', fontSize: 32, marginRight: 20, paddingBottom: 2 },
  tapZones: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
  },
  tapZone: { flex: 1 },
  storyTextContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
  },
  storyText: {
    textAlign: 'center',
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyInput: {
    flex: 1,
    height: 44,
    borderWidth: 1,
    borderColor: '#fff',
    borderRadius: 22,
    paddingHorizontal: 15,
    color: '#fff',
  },
  emoji: { fontSize: 28, marginLeft: 10 },
  optionsTriggerButton: {
    position: 'absolute',
    bottom: 10,
    right: 10,
  },
  optionsTriggerText: {
    color: '#fff',
    fontSize: 32,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalButton: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 12,
    width: '80%',
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
});