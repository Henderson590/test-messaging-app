// screens/CustomizeChatScreen.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { db } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';

const THEME_COLORS = [
  { name: 'Default Blue', color: '#0078d4' },
  { name: 'Forest Green', color: '#228B22' },
  { name: 'Royal Purple', color: '#8a2be2' },
  { name: 'Sunset Orange', color: '#ff4500' },
  { name: 'Hot Pink', color: '#ff69b4' },
  { name: 'Classic Black', color: '#000000' },
];

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

export default function CustomizeChatScreen({ route, navigation }) {
  const { chatId } = route.params;
  const { colors } = useTheme();

  const handleSetTheme = async (color) => {
    if (!chatId) {
      Toast.show({ type: 'error', text1: 'Chat not found.' });
      return;
    }
    try {
      const settingsRef = doc(db, 'chats', chatId, 'settings', 'theme');
      await setDoc(settingsRef, { color: color }, { merge: true });
      Toast.show({ type: 'success', text1: 'Chat theme updated!' });
      navigation.goBack();
    } catch (err) {
      console.error("Failed to set theme:", err);
      Toast.show({ type: 'error', text1: 'Could not set theme.' });
    }
  };

  const handleSetEmoji = async (emoji) => {
    if (!chatId) {
      Toast.show({ type: 'error', text1: 'Chat not found.' });
      return;
    }
    try {
      const settingsRef = doc(db, 'chats', chatId, 'settings', 'theme');
      await setDoc(settingsRef, { emoji: emoji }, { merge: true });
      Toast.show({ type: 'success', text1: 'Chat emoji updated!' });
      navigation.goBack();
    } catch (err) {
      console.error("Failed to set emoji:", err);
      Toast.show({ type: 'error', text1: 'Could not set emoji.' });
    }
  };

  const handleAddCustomEmoji = () => {
    Alert.prompt(
      "Add Custom Emoji",
      "Enter an emoji to use in this chat.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Set",
          onPress: (emoji) => {
            // Basic validation: take the first character/emoji
            if (emoji && emoji.trim()) handleSetEmoji(emoji.trim().slice(0, 2));
          },
        },
      ],
      "plain-text"
    );
  };

  const renderColorItem = ({ item }) => (
    <TouchableOpacity style={[styles.colorItem, { backgroundColor: colors.surface }]} onPress={() => handleSetTheme(item.color)}>
      <View style={[styles.colorPreview, { backgroundColor: item.color }]} />
      <Text style={[styles.colorName, { color: colors.text }]}>{item.name}</Text>
    </TouchableOpacity>
  );

  const renderEmojiItem = (emoji) => (
    <TouchableOpacity key={emoji} style={styles.emojiButton} onPress={() => handleSetEmoji(emoji)}>
      <Text style={[styles.emojiText, { color: colors.text }]}>{emoji}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Customize Chat</Text>
      </View>
      <ScrollView contentContainerStyle={styles.listContainer}>
        <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Theme Color</Text>
        <View>
          {THEME_COLORS.map(item => <View key={item.name}>{renderColorItem({ item })}</View>)}
        </View>

        <Text style={[styles.sectionTitle, { color: colors.subtext }]}>Chat Emoji</Text>
        <View style={[styles.emojiContainer, { backgroundColor: colors.surface }]}>
          {QUICK_EMOJIS.map(renderEmojiItem)}
          <TouchableOpacity style={styles.emojiButton} onPress={handleAddCustomEmoji}>
            <Text style={styles.addEmojiText}>+</Text>
          </TouchableOpacity>
        </View>
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
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  backArrow: { fontSize: 16, color: '#0078d4', paddingBottom: 2, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 2, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 20, marginBottom: 10, paddingHorizontal: 10 },
  listContainer: { padding: 10 },
  colorItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    marginBottom: 10,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    marginRight: 20,
    borderWidth: 1,
    borderColor: '#eee',
  },
  colorName: {
    fontSize: 16,
  },
  emojiContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    borderRadius: 12,
    padding: 10,
  },
  emojiButton: {
    padding: 10,
  },
  emojiText: {
    fontSize: 32,
  },
  addEmojiText: {
    fontSize: 32,
    color: '#0078d4',
  },
});