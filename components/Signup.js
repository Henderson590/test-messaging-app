import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { supabase } from "../supabase";
import Toast from "react-native-toast-message";

export default function Signup({ navigation }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    if (!username || !email || !password) {
      Toast.show({ type: "error", text1: "Please fill in all fields" });
      return;
    }

    setLoading(true);
    try {
      // Sign up user with Supabase Auth
      const { data, error } = await supabase.auth.signUp({
        email: email,
        password: password,
        options: {
          data: {
            username: username.trim(),
          }
        }
      });

      if (error) {
        throw error;
      }

      // Save additional user data to Supabase database
      if (data.user) {
        const { error: profileError } = await supabase
          .from('users')
          .insert([
            {
              id: data.user.id,
              username: username.trim(),
              email: email,
              created_at: new Date(),
              friends: []
            }
          ]);

        if (profileError) {
          console.warn('Profile creation error:', profileError);
        }
      }

      Toast.show({ type: "success", text1: "Account created successfully!" });

      setUsername("");
      setEmail("");
      setPassword("");
    } catch (err) {
      console.error("Signup error:", err);
      Toast.show({ type: "error", text1: "Failed to create account", text2: err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.box}>
        <Text style={styles.title}>Sign Up</Text>
        <Text style={styles.info}>
          Choose a username unique to you. Friends will use this to add you.
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Username"
          placeholderTextColor="#000"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#000"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#000"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.button, loading && { opacity: 0.6 }]}
          onPress={handleSignup}
          disabled={loading}
        >
          <Text style={styles.buttonText}>{loading ? "Creating..." : "Sign Up"}</Text>
        </TouchableOpacity>
      </View>
      <Toast />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  box: {
    width: "100%",
    maxWidth: 400,
    padding: 24,
    backgroundColor: "#fff",
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 5,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 12,
    textAlign: "center",
    color: "#0078d4",
  },
  info: {
    fontSize: 14,
    marginBottom: 18,
    textAlign: "center",
    color: "#555",
  },
  input: {
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
    fontSize: 16,
    backgroundColor: "#fdfdfd",
    color: "#927e96", // fixed
  },
  button: {
    backgroundColor: "#0078d4",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 6,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 16,
  },
});

