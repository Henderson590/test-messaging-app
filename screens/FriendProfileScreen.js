// screens/FriendProfileScreen_Stub.js
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "../contexts/ThemeContext";

export default function FriendProfileScreen({ route, navigation }) {
  const { friend } = route.params || {};
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Friend Profile</Text>
      </View>
      
      <View style={styles.content}>
        <Text style={[styles.message, { color: colors.text }]}>
          Friend Profile - Under Construction
        </Text>
        <Text style={[styles.subtitle, { color: colors.subtext }]}>
          This feature is being updated for Supabase compatibility.
        </Text>
        {friend && (
          <Text style={[styles.friendInfo, { color: colors.text }]}>
            Friend: {friend.username || friend.email || "Unknown"}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    paddingTop: 50,
    paddingBottom: 15,
    borderBottomWidth: 1,
  },
  backArrow: {
    fontSize: 24,
    color: "#0078d4",
    marginRight: 15,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  message: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
  },
  friendInfo: {
    fontSize: 16,
    textAlign: "center",
  },
});