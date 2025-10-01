// screens/MediaGalleryScreen.js
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Pressable,
  Modal,
} from "react-native";

export default function MediaGalleryScreen({ route, navigation }) {
  const { media } = route.params;
  const [activeImage, setActiveImage] = useState(null);

  const openImage = (item, index) => {
    setActiveImage(item);
  };

  const closeImage = () => {
    setActiveImage(null);
  };

  const renderItem = ({ item, index }) => {
    // Ensure we have a unique key for the ref
    const itemKey = item.id || index;
    return (
      <TouchableOpacity
        style={styles.imageContainer}
        onPress={() => openImage(item, itemKey)}
      >
        <Image source={{ uri: item.image }} style={styles.image} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shared Media</Text>
      </View>
      <FlatList
        data={media}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.list}
      />
      {activeImage && (
        <Modal visible={!!activeImage} transparent={true} animationType="fade" onRequestClose={closeImage}>
          <Pressable style={styles.fullScreenContainer} onPress={closeImage}>
            <Image source={{ uri: activeImage.image }} style={styles.fullScreenImage} resizeMode="contain" />
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 10,
    backgroundColor: "#f7f7f7",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backArrow: { fontSize: 16, color: "#0078d4", marginRight: 12, paddingBottom: 2, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: "bold", flex: 2, textAlign: 'center' },
  list: { padding: 4 },
  imageContainer: { flex: 1 / 3, aspectRatio: 1, padding: 4 },
  image: { width: "100%", height: "100%", borderRadius: 4 },
  fullScreenContainer: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)', justifyContent: 'center', alignItems: 'center' },
  fullScreenImage: { width: '100%', height: '100%' },
});