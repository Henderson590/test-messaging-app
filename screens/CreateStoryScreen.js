// screens/CreateStoryScreen.js
import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput, Alert, Dimensions } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { db, auth } from '../firebase';
import { collection, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { Video, ResizeMode } from 'expo-av';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function CreateStoryScreen({ navigation }) {
  const { colors } = useTheme();
  const [media, setMedia] = useState(null); // Can be { uri, type: 'image' | 'video' }
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm.status !== 'granted') {
      Alert.alert("Permission required", "Please allow access to your photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setMedia({ uri: asset.uri, type: asset.type });
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (permissionResult.granted === false) {
      Alert.alert("You've refused to allow this app to access your camera!");
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setMedia({ uri: asset.uri, type: asset.type });
    }
  };

  const handlePostStory = async () => {
    if (!media) return;
    setLoading(true);

    try {
      // 1. Upload media to Cloudinary
      const data = new FormData();
      const fileType = media.type === 'video' ? 'video/mp4' : 'image/jpeg';
      const fileName = media.type === 'video' ? `story_${Date.now()}.mp4` : `story_${Date.now()}.jpg`;
      data.append("file", { uri: media.uri, type: fileType, name: fileName });
      data.append("upload_preset", "test-messaging-app");
      const endpoint = media.type === 'video' ? "https://api.cloudinary.com/v1_1/dx2yetm8n/video/upload" : "https://api.cloudinary.com/v1_1/dx2yetm8n/image/upload";

      const res = await fetch(endpoint, { method: "POST", body: data });
      const file = await res.json();
      if (!file.secure_url) throw new Error("Upload failed");

      // 2. Get current user's profile data
      const userDoc = await getDoc(doc(db, 'users', auth.currentUser.uid));
      const userData = userDoc.data();

      // 3. Save story to Firestore
      await addDoc(collection(db, 'stories'), {
        uid: auth.currentUser.uid,
        username: userData.username,
        profileAnimal: userData.profileAnimal || null,
        imageUrl: file.secure_url,
        mediaType: media.type,
        textOverlays: [], // No text overlays for now
        createdAt: serverTimestamp(),
      });

      Toast.show({ type: 'success', text1: 'Story posted!' });
      navigation.goBack();
    } catch (error) {
      console.error("Error posting story:", error);
      Toast.show({ type: 'error', text1: 'Failed to post story.' });
    } finally {
      setLoading(false);
    }
  };

  if (media) {
    return (
      <View style={styles.container}>
        {media.type === 'image' ? (
          <Image source={{ uri: media.uri }} style={styles.previewImage} />
        ) : (
          <Video
            source={{ uri: media.uri }}
            style={styles.previewImage}
            shouldPlay
            isLooping
            resizeMode={ResizeMode.CONTAIN}
          />
        )}
        <View style={styles.overlay}>
          <View style={styles.headerControls}>
            <TouchableOpacity style={styles.controlButton} onPress={() => setMedia(null)}>
              <Text style={styles.controlText}>✕</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.postButton} onPress={handlePostStory} disabled={loading}>
            <Text style={styles.postButtonText}>{loading ? 'Posting...' : 'Post Story'}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, styles.selectionContainer, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>Create a Story</Text>
      <TouchableOpacity style={styles.button} onPress={pickImage}>
        <Text style={styles.buttonText}>Choose from Library</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={takePhoto}>
        <Text style={styles.buttonText}>Take a Photo</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.cancelButton} onPress={() => navigation.goBack()}>
        <Text style={styles.cancelButtonText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  selectionContainer: { padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 30 },
  button: { backgroundColor: '#0078d4', padding: 15, borderRadius: 10, marginBottom: 20, width: '80%', alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  cancelButton: { marginTop: 20 },
  cancelButtonText: { color: '#ff4d4d', fontSize: 16 },
  previewImage: { width: '100%', height: '100%' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'flex-end' },
  headerControls: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  controlButton: { backgroundColor: 'rgba(0,0,0,0.5)', padding: 10, borderRadius: 20 },
  controlText: { fontSize: 20, color: '#fff' },
  textContainer: {
    position: 'absolute',
    top: SCREEN_HEIGHT / 2 - 50, // Center vertically
    left: SCREEN_WIDTH / 2 - 100, // Center horizontally
  },
  textWrapper: {
    padding: 10,
  },
  draggableText: {
    color: 'white',
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: -1, height: 1 },
    textShadowRadius: 10,
  },
  postButton: { backgroundColor: '#fff', paddingVertical: 12, paddingHorizontal: 30, borderRadius: 30, position: 'absolute', bottom: 40, alignSelf: 'center' },
  postButtonText: { color: '#0078d4', fontSize: 16, fontWeight: 'bold' },
});