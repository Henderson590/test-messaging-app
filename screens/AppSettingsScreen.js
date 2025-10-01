// screens/AppSettingsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { auth, db } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { reauthenticateWithCredential, EmailAuthProvider, updatePassword } from 'firebase/auth';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';

export default function AppSettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const { theme, toggleTheme, colors } = useTheme();

  useEffect(() => {
    const fetchUserData = async () => {
      const userDoc = await getDoc(doc(db, "users", auth.currentUser.uid));
      if (userDoc.exists()) {
        setUser({ uid: userDoc.id, ...userDoc.data() });
      }
    };
    fetchUserData();
  }, []);

  const reauthenticate = (currentPassword) => {
    const user = auth.currentUser;
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    return reauthenticateWithCredential(user, cred);
  };

  const handleChangePassword = () => {
    let currentPassword, newPassword;
    Alert.prompt(
      "Change Password",
      "Enter your current password.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Next",
          onPress: (password) => {
            currentPassword = password;
            Alert.prompt(
              "Change Password",
              "Enter your new password.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Confirm",
                  onPress: async (newPass) => {
                    newPassword = newPass;
                    try {
                      await reauthenticate(currentPassword);
                      await updatePassword(auth.currentUser, newPassword);
                      Toast.show({ type: 'success', text1: 'Password updated successfully!' });
                    } catch (err) {
                      console.error(err);
                      Toast.show({ type: 'error', text1: 'Failed to update password.', text2: 'Please check your current password.' });
                    }
                  },
                },
              ],
              "secure-text"
            );
          },
        },
      ],
      "secure-text"
    );
  };

  const handleChangeUsername = () => {
    let password, newUsername;
    Alert.prompt(
      "Change Username",
      "To change your username, please confirm your password.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Next",
          onPress: (pass) => {
            password = pass;
            Alert.prompt(
              "Change Username",
              "Enter your new username.",
              async (username) => {
                newUsername = username;
                if (!newUsername.trim()) return;
                try {
                  await reauthenticate(password);
                  const userRef = doc(db, "users", auth.currentUser.uid);
                  await updateDoc(userRef, { username: newUsername.trim() });
                  Toast.show({ type: 'success', text1: 'Username updated!' });
                } catch (err) {
                  console.error(err);
                  Toast.show({ type: 'error', text1: 'Failed to update username.', text2: 'Please check your password.' });
                }
              },
              "plain-text"
            );
          },
        },
      ],
      "secure-text"
    );
  };

  const handleSetBirthday = () => {
    // This is a simplified version. A real app would use a Date Picker.
    Alert.prompt("Set Birthday", "Enter your birthday (MM/DD/YYYY)", async (birthday) => {
      if (!birthday) return;
      try {
        const userRef = doc(db, "users", auth.currentUser.uid);
        await updateDoc(userRef, { birthday: birthday.trim() });
        Toast.show({ type: 'success', text1: 'Birthday saved!' });
      } catch (err) {
        Toast.show({ type: 'error', text1: 'Failed to save birthday.' });
      }
    });
  };

  const handleLogout = async () => {
    await auth.signOut();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>App Settings</Text>
      </View>
      <ScrollView>
        <View style={[styles.settingRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
          <Switch value={theme === 'dark'} onValueChange={toggleTheme} />
        </View>
        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} onPress={handleChangeUsername}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Change Username</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} onPress={handleChangePassword}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Change Password</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.settingRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]} onPress={handleSetBirthday}>
          <Text style={[styles.settingLabel, { color: colors.text }]}>Set Birthday</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.settingRow, styles.logoutButton, { backgroundColor: colors.surface }]} onPress={handleLogout}>
          <Text style={[styles.settingLabel, { color: 'red' }]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        paddingHorizontal: 15,
        paddingTop: 60,
        paddingBottom: 20,
        borderBottomWidth: 1
    },
    backArrow: { fontSize: 16, color: '#0078d4', paddingBottom: 2, flex: 1 },
    headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 2, textAlign: 'center' },
    settingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
    },
    settingLabel: {
        fontSize: 16,
    },
    arrow: {
        fontSize: 30,
        color: '#ccc',
    },
    logoutButton: {
        marginTop: 40,
        justifyContent: 'center',
    }
});