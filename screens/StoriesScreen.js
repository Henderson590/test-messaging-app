import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal, ActivityIndicator, FlatList, Image } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import * as ImagePicker from 'expo-image-picker';
import Toast from 'react-native-toast-message';
import SupabaseService from "../services/SupabaseService";

export default function StoriesScreen({ route, navigation }) {
  const { colors } = useTheme();
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stories, setStories] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadStories = async () => {
    try {
      setRefreshing(true);
      const { data, error } = await SupabaseService.getAllStories();
      if (!error) setStories(data || []);
    } finally {
      setRefreshing(false);
    }
  };

  const handlePickFromGallery = async () => {
    try {
      setOptionsVisible(false);
      const user = await SupabaseService.getCurrentUser();
      if (!user) return;
      setBusy(true);
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.9 });
      if (result.canceled) return;
      const asset = result.assets[0];
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { path, error } = await SupabaseService.uploadImageFromUri('stories', asset.uri, fileName);
      if (error) throw error;
      const { error: storyError } = await SupabaseService.createStory(user.id, 'image', path);
      if (storyError) throw storyError;
      Toast.show({ type: 'success', text1: 'Story posted!' });
      loadStories();
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Failed to post story', text2: err.message });
    }
  };

  React.useEffect(() => {
    loadStories();
  }, []);

  const handleUseCamera = () => {
    setOptionsVisible(false);
    navigation.navigate('CameraScreen', { storyMode: true });
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Stories</Text>
        <TouchableOpacity onPress={() => setOptionsVisible(true)}>
          <Text style={styles.plus}>＋</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.content}>
        {refreshing ? (
          <ActivityIndicator />
        ) : (
          <FlatList
            data={stories}
            keyExtractor={(item) => item.id}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.storyItem} onPress={() => navigation.navigate('StoryViewerScreen', { stories: stories, startIndex: stories.findIndex(s => s.id === item.id) })}>
                <Image source={{ uri: item.signed_url || item.content_url }} style={styles.storyThumb} />
                <Text style={{ textAlign: 'center', marginTop: 6 }} numberOfLines={1}>
                  {item.users?.username || 'Unknown'}
                </Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              <View style={{ alignItems: 'center' }}>
                <Text style={[styles.message, { color: colors.text }]}>No stories yet</Text>
                <Text style={[styles.subtitle, { color: colors.subtext }]}>Tap + to add one</Text>
              </View>
            }
          />
        )}
      </View>

      <Modal visible={optionsVisible || busy} transparent animationType="fade" onRequestClose={() => setOptionsVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {busy ? (
              <View style={{ padding: 24, alignItems: 'center' }}>
                <ActivityIndicator />
                <Text style={{ marginTop: 12 }}>Uploading...</Text>
              </View>
            ) : (
            <><TouchableOpacity style={styles.modalOption} onPress={handlePickFromGallery}><Text>Choose from gallery</Text></TouchableOpacity><TouchableOpacity style={styles.modalOption} onPress={handleUseCamera}><Text>Use camera</Text></TouchableOpacity><TouchableOpacity style={styles.modalOption} onPress={() => setOptionsVisible(false)}><Text style={{ color: '#f33' }}>Cancel</Text></TouchableOpacity></>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 50, paddingBottom: 15 },
  backArrow: { fontSize: 24, color: "#0078d4" },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  plus: { fontSize: 26, color: '#0078d4' },
  content: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  message: { fontSize: 18, fontWeight: "600", textAlign: "center", marginBottom: 10 },
  subtitle: { fontSize: 14, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center' },
  modalSheet: { width: '85%', borderRadius: 16, padding: 16 },
  storyItem: { width: 120, marginHorizontal: 8 },
  storyThumb: { width: 120, height: 160, borderRadius: 12, backgroundColor: '#ddd' },
  modalOption: { paddingVertical: 14, alignItems: 'center' },
});
