import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, FlatList, TextInput, ScrollView, Alert } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { ANIMAL_IMAGES } from "../assets/images";
import SupabaseService from "../services/SupabaseService";

export default function UserProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);
  const [selectedAnimal, setSelectedAnimal] = useState(null);
  const [currentHat, setCurrentHat] = useState(null);
  const [bio, setBio] = useState("");
  const animals = Object.keys(ANIMAL_IMAGES);

  useEffect(() => {
    const load = async () => {
      const u = await SupabaseService.getCurrentUser();
      if (!u) return;
      setUser(u);
      const { data: profile } = await SupabaseService.getUserProfile(u.id);
      const base = profile?.profileAnimal?.base || animals[0];
      setSelectedAnimal(base);
      setCurrentHat(profile?.profileAnimal?.hat || null);
      setBio(profile?.bio || "");
    };
    load();
  }, []);

  const handleSave = async () => {
    try {
      if (!user) return;
      const updates = {
        profileAnimal: { base: selectedAnimal, hat: currentHat || 'None' },
        bio: bio,
      };
      const { error } = await SupabaseService.updateUserProfile(user.id, updates);
      if (error) throw error;
      Alert.alert('Saved', 'Your profile has been updated');
    } catch (err) {
      Alert.alert('Error', err.message);
    }
  };

  const renderAnimal = ({ item }) => (
    <TouchableOpacity
      style={[styles.animalButton, selectedAnimal === item && styles.animalSelected]}
      onPress={() => setSelectedAnimal(item)}
    >
      <Image source={ANIMAL_IMAGES[item]} style={styles.animalIcon} />
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>User Profile</Text>
        <TouchableOpacity onPress={handleSave}>
          <Text style={styles.saveText}>Save</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Large preview */}
        {selectedAnimal && (
          <Image source={ANIMAL_IMAGES[selectedAnimal]} style={styles.largeAvatar} />
        )}

        {/* Bio */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Bio</Text>
        <TextInput
          style={styles.bioInput}
          placeholder="Tell people about you..."
          placeholderTextColor="#999"
          value={bio}
          onChangeText={setBio}
          multiline
        />

        {/* Animal picker */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Choose your animal</Text>
        <FlatList
          data={animals}
          numColumns={4}
          keyExtractor={(k) => k}
          renderItem={renderAnimal}
          contentContainerStyle={{ gap: 8 }}
          columnWrapperStyle={{ justifyContent: 'space-between', marginBottom: 8 }}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: 'space-between', paddingHorizontal: 15, paddingTop: 50, paddingBottom: 15 },
  backArrow: { fontSize: 24, color: "#0078d4" },
  headerTitle: { fontSize: 18, fontWeight: "600" },
  saveText: { fontSize: 16, color: '#0078d4', fontWeight: '600' },
  content: { padding: 20 },
  largeAvatar: { width: 160, height: 160, alignSelf: 'center', marginVertical: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  bioInput: { minHeight: 80, borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 12, textAlignVertical: 'top', backgroundColor: '#fff' },
  animalButton: { width: '23%', aspectRatio: 1, backgroundColor: '#fff', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#eee' },
  animalSelected: { borderColor: '#0078d4', borderWidth: 2 },
  animalIcon: { width: 48, height: 48 },
});
