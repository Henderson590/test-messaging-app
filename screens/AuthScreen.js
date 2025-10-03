// screens/AuthScreen.js
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import Signup from "../components/Signup";
import Login from "../components/Login";


// Define a fixed light theme for this screen
const lightColors = {
  background: '#f0f2f5', // A neutral light grey
  surface: '#ffffff',    // White for the login/signup boxes
  text: '#1c1e21',       // A dark grey for text
};

export default function AuthScreen({ navigation }) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: lightColors.background }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.container, { backgroundColor: lightColors.background }]}
      >
        <Image source={require("../assets/ChatterBox.png")} style={styles.logo} resizeMode="contain" />
        <Text style={[styles.title, { color: lightColors.text }]}>Login or Signup</Text>

        <View style={[styles.boxStyle, { backgroundColor: lightColors.surface }]}>
          <Signup />
        </View>

        <View style={[styles.boxStyle, { backgroundColor: lightColors.surface }]}>
          <Login />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center", // Keep for horizontal centering
    // Removed justifyContent: "center" to allow content to align to top
    paddingVertical: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  logo: {
    width: 250,
    height: 250,
    marginBottom: -60,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 24,
    textAlign: "center",
  },
  boxStyle: {
    width: "90%",
    padding: 20,
    marginBottom: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
});
