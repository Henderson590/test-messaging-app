import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, FlatList } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { Camera, CameraType } from 'expo-camera';
import * as MediaLibrary from 'expo-media-library';
import Toast from 'react-native-toast-message';
import SupabaseService from "../services/SupabaseService";

export default function CameraScreen({ route, navigation }) {
  const { colors } = useTheme();
  const [hasPermission, setHasPermission] = useState(null);
  const [previewUri, setPreviewUri] = useState(null);
  const [friendsModal, setFriendsModal] = useState(false);
  const [friends, setFriends] = useState([]);
  const [user, setUser] = useState(null);
  const cameraRef = useRef(null);
  const storyMode = route?.params?.storyMode;

  useEffect(() => {
    (async () => {
      const { status } = await Camera.requestCameraPermissionsAsync();
      const { status: mediaStatus } = await MediaLibrary.requestPermissionsAsync();
      setHasPermission(status === 'granted' && mediaStatus === 'granted');
      const u = await SupabaseService.getCurrentUser();
      setUser(u);
    })();
  }, []);

  const takePhoto = async () => {
    try {
      if (!cameraRef.current) return;
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.9 });
      setPreviewUri(photo.uri);
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Failed to take photo' });
    }
  };

  const downloadPhoto = async () => {
    try {
      if (!previewUri) return;
      await MediaLibrary.saveToLibraryAsync(previewUri);
      Toast.show({ type: 'success', text1: 'Saved to gallery' });
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Save failed', text2: err.message });
    }
  };

  const openSendTo = async () => {
    if (!user) return;
    const { data } = await SupabaseService.getFriendsProfiles(user.id);
    setFriends(data || []);
    setFriendsModal(true);
  };

  const uploadToBucket = async (bucket) => {
    const fileName = `${user.id}/${Date.now()}.jpg`;
    const { url, error } = await SupabaseService.uploadImageFromUri(bucket, previewUri, fileName);
    if (error) throw error;
    return url;
  };

  const sendToFriend = async (friend) => {
    try {
      if (!previewUri || !user) return;
      const url = await uploadToBucket('messages');
      const { error } = await SupabaseService.sendImageToFriend(user.id, friend.uid, url);
      if (error) throw error;
      Toast.show({ type: 'success', text1: `Sent to ${friend.username || friend.email}` });
      setFriendsModal(false);
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Failed to send', text2: err.message });
    }
  };

  const postStoryIfNeeded = async () => {
    if (!storyMode) return;
    try {
      if (!previewUri || !user) return;
      const url = await uploadToBucket('stories');
      const { error } = await SupabaseService.createStory(user.id, 'image', url);
      if (error) throw error;
      Toast.show({ type: 'success', text1: 'Story posted!' });
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Failed to post story', text2: err.message });
    }
  };

  if (hasPermission === null) {
    return <View style={styles.center}><Text>Requesting camera permission...</Text></View>;
  }
  if (hasPermission === false) {
    return <View style={styles.center}><Text>No access to camera</Text></View>;
  }

  return (
    <View style={styles.container}>
      {!previewUri ? (
        <Camera style={styles.camera} type={CameraType.back} ref={cameraRef}>
          <TouchableOpacity style={styles.closeButton} onPress={() => navigation.goBack()}>
            <Text style={styles.closeText}>×</Text>
          </TouchableOpacity>
          <View style={styles.shutterContainer}>
            <TouchableOpacity style={styles.shutter} onPress={takePhoto} />
          </View>
        </Camera>
      ) : (
        <View style={styles.previewContainer}>
          <Image source={{ uri: previewUri }} style={styles.preview} />
          <View style={styles.previewActions}>
            <TouchableOpacity style={styles.actionBtn} onPress={downloadPhoto}><Text>Download</Text></TouchableOpacity>
            {storyMode && (
              <TouchableOpacity style={styles.actionBtn} onPress={postStoryIfNeeded}><Text>Post Story</Text></TouchableOpacity>
            )}
            <TouchableOpacity style={styles.actionBtn} onPress={openSendTo}><Text>Send to</Text></TouchableOpacity>
            <TouchableOpacity style={styles.actionBtn} onPress={() => setPreviewUri(null)}><Text>Retake</Text></TouchableOpacity>
          </View>
        </View>
      )}

      <Modal visible={friendsModal} transparent animationType="fade" onRequestClose={() => setFriendsModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <FlatList
              data={friends}
              keyExtractor={(f) => f.uid}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.friendRow} onPress={() => sendToFriend(item)}>
                  <Text>{item.nickname || item.username || item.email}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text>No friends</Text>}
            />
            <TouchableOpacity style={[styles.actionBtn, { alignSelf: 'center', marginTop: 12 }]} onPress={() => setFriendsModal(false)}><Text>Close</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  closeButton: { position: 'absolute', top: 48, right: 16, zIndex: 2, backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 16, width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 22, lineHeight: 22 },
  shutterContainer: { position: 'absolute', bottom: 48, alignSelf: 'center' },
  shutter: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#fff', borderWidth: 6, borderColor: '#ddd' },
  previewContainer: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1, resizeMode: 'contain' },
  previewActions: { flexDirection: 'row', justifyContent: 'space-around', padding: 12, backgroundColor: '#fff' },
  actionBtn: { paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#eee', borderRadius: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalSheet: { width: '85%', maxHeight: '60%', backgroundColor: '#fff', borderRadius: 16, padding: 16 },
  friendRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
});
