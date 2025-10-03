// screens/AppSettingsScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch, Alert, ScrollView } from 'react-native';
import { supabase } from '../supabase';
import SupabaseService from '../services/SupabaseService';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';

export default function AppSettingsScreen({ navigation }) {
  const [user, setUser] = useState(null);
  const { theme, toggleTheme, colors } = useTheme();

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = await SupabaseService.getCurrentUser();
      if (currentUser) {
        const { data: userData, error } = await SupabaseService.getUserProfile(currentUser.id);
        if (userData && !error) {
          setUser({ uid: userData.id, ...userData });
        }
      }
    };
    fetchUserData();
  }, []);

  const handleChangePassword = () => {
    Alert.prompt(
      "Change Password",
      "Enter your new password.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: async (newPassword) => {
            if (!newPassword || newPassword.length < 6) {
              Toast.show({ type: 'error', text1: 'Password must be at least 6 characters long.' });
              return;
            }
            try {
              const { error } = await SupabaseService.updatePassword(newPassword);
              if (error) {
                throw error;
              }
              Toast.show({ type: 'success', text1: 'Password updated successfully!' });
            } catch (err) {
              console.error(err);
              Toast.show({ type: 'error', text1: 'Failed to update password.', text2: err.message });
            }
          },
        },
      ],
      "secure-text"
    );
  };

  const handleChangeUsername = () => {
    Alert.prompt(
      "Change Username",
      "Enter your new username.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update",
          onPress: async (newUsername) => {
            if (!newUsername || !newUsername.trim()) {
              Toast.show({ type: 'error', text1: 'Username cannot be empty.' });
              return;
            }
            try {
              const currentUser = await SupabaseService.getCurrentUser();
              if (!currentUser) throw new Error('User not found');
              
              const { error } = await SupabaseService.updateUserProfile(currentUser.id, {
                username: newUsername.trim()
              });
              
              if (error) {
                throw error;
              }
              
              Toast.show({ type: 'success', text1: 'Username updated!' });
              setUser(prev => ({ ...prev, username: newUsername.trim() }));
            } catch (err) {
              console.error(err);
              Toast.show({ type: 'error', text1: 'Failed to update username.', text2: err.message });
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const handleSetBirthday = () => {
    // This is a simplified version. A real app would use a Date Picker.
    Alert.prompt("Set Birthday", "Enter your birthday (MM/DD/YYYY)", async (birthday) => {
      if (!birthday) return;
      try {
        const currentUser = await SupabaseService.getCurrentUser();
        if (!currentUser) throw new Error('User not found');
        
        const { error } = await SupabaseService.updateUserProfile(currentUser.id, {
          birthday: birthday.trim()
        });
        
        if (error) {
          throw error;
        }
        
        Toast.show({ type: 'success', text1: 'Birthday saved!' });
        setUser(prev => ({ ...prev, birthday: birthday.trim() }));
      } catch (err) {
        console.error(err);
        Toast.show({ type: 'error', text1: 'Failed to save birthday.', text2: err.message });
      }
    });
  };

  const handleLogout = async () => {
    try {
      const { error } = await SupabaseService.signOut();
      if (error) {
        Toast.show({ type: 'error', text1: 'Failed to sign out.', text2: error.message });
      }
    } catch (err) {
      console.error(err);
      Toast.show({ type: 'error', text1: 'Failed to sign out.' });
    }
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
    backArrow: { fontSize: 26, color: '#0078d4', paddingBottom: 2, flex: 1 },
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

