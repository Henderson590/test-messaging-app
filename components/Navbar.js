// Navbar.js
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function Navbar({ navigation }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderTopColor: colors.border, paddingBottom: 40 }]}>
      <View style={styles.leftContainer}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.background }]}
          onPress={() => navigation.navigate("StoriesScreen")}
        >
          <Text style={styles.storiesIcon}>📖</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={[styles.cameraButton, { backgroundColor: colors.background }]}
        onPress={() => navigation.navigate("CameraScreen")}
      >
        <Text style={styles.cameraIcon}>📷</Text>
      </TouchableOpacity>

      <View style={styles.rightContainer}>
        <TouchableOpacity
          style={[styles.iconButton, { backgroundColor: colors.background }]}
          onPress={() => navigation.navigate("UserProfileScreen")}
        >
          <Text style={styles.profileIcon}>👤</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
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
