// Navbar.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function Navbar({ navigation, onStories, onCamera, onProfile }) {
  const { colors } = useTheme();

  const goStories = () => {
    if (navigation?.navigate) return navigation.navigate("StoriesScreen");
    if (typeof onStories === 'function') return onStories();
  };
  const goCamera = () => {
    if (navigation?.navigate) return navigation.navigate("CameraScreen");
    if (typeof onCamera === 'function') return onCamera();
  };
  const goProfile = () => {
    if (navigation?.navigate) return navigation.navigate("UserProfileScreen");
    if (typeof onProfile === 'function') return onProfile();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: 40 }]}>
      <View style={styles.leftContainer}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.background }]}
          onPress={goStories}
        >
          <Text style={styles.storiesIcon}>📖</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.cameraButton, { backgroundColor: colors.background }]}
        onPress={goCamera}
      >
        <Text style={styles.cameraIcon}>📷</Text>
      </TouchableOpacity>

      <View style={styles.rightContainer}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.background }]}
          onPress={goProfile}
        >
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 110,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  leftContainer: { flex: 1, alignItems: 'flex-start' },
  rightContainer: { flex: 1, alignItems: 'flex-end' },
  cameraButton: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
  cameraIcon: { fontSize: 24 },
  storiesIcon: { fontSize: 28 },
  profileIcon: { fontSize: 28 },
  iconButton: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' },
});
