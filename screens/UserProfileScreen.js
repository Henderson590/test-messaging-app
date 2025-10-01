// screens/UserProfileScreen.js
import React, { useState, useEffect, useCallback } from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ScrollView, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform } from "react-native";
import { db, auth } from '../firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { useFocusEffect } from '@react-navigation/native';
import Toast from 'react-native-toast-message';
import { useTheme } from '../contexts/ThemeContext';
import { encode } from 'base-64';
import { ANIMAL_IMAGES, HAT_IMAGES } from '../assets/images';

const PRESET_ANIMALS = ['capybara', 'cow', 'penguin'];
const ACCESSORIES = {
  hats: ['None', 'cowboy-hat', 'tophat', 'crown'],
};

// Replace with your actual Spotify credentials
const SPOTIFY_CLIENT_ID = '13dd7f597bf24d5487189185eccd08af';
const SPOTIFY_CLIENT_SECRET = '9b01895fdfa8445c84b884d80b06ca5a';

export default function UserProfileScreen({ route, navigation }) {
  const { userId } = route.params || {};
  const { colors } = useTheme();
  const [profileData, setProfileData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spotifyToken, setSpotifyToken] = useState(null);
  const [songSearchResults, setSongSearchResults] = useState([]);
  const [isSearchingSong, setIsSearchingSong] = useState(false);

  const isMyProfile = !userId || userId === auth.currentUser.uid;
  const profileUserId = userId || auth.currentUser.uid;

  const fetchProfile = useCallback(async () => {
    if (!profileUserId) return;
    setLoading(true);
    const userRef = doc(db, "users", profileUserId);
    const userDoc = await getDoc(userRef);
    if (userDoc.exists()) {
      setProfileData(userDoc.data());
    }
    setLoading(false);
  }, [profileUserId]);

  useFocusEffect(
    useCallback(() => {
      fetchProfile();
    }, [fetchProfile])
  );

  // Get Spotify API Token
  useEffect(() => {
    const getSpotifyToken = async () => {
      try {
        const response = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + encode(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)
          },
          body: 'grant_type=client_credentials'
        });
        const data = await response.json();
        setSpotifyToken(data.access_token);
      } catch (error) {
        console.error('Error fetching Spotify token:', error);
      }
    };
    getSpotifyToken();
  }, []);

  const handleSaveChanges = async () => {
    if (!isMyProfile) return;
    const userRef = doc(db, "users", auth.currentUser.uid);
    try {
      await updateDoc(userRef, {
        bio: profileData.bio || "",
        profileAnimal: profileData.profileAnimal || { base: 'capybara', hat: 'None' },
        song: profileData.song || null,
      });
      Toast.show({ type: 'success', text1: 'Profile saved!' });
    } catch (err) {
      console.error("Failed to save profile:", err);
      Toast.show({ type: 'error', text1: 'Could not save profile.' });
    }
  };

  const handleSearchSong = () => {
    if (!isMyProfile) return;
    Alert.prompt("Search for a Song", "Enter a song title.", async (songTitle) => {
      if (!songTitle) return;
      const token = spotifyToken;
      if (!token) {
        Toast.show({ type: 'error', text1: 'Could not connect to Spotify.' });
        return;
      }
      setIsSearchingSong(true);
      try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(songTitle)}&type=track&limit=5`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        const data = await response.json();
        const results = data.tracks.items.map(item => ({
          title: item.name,
          artist: item.artists.map(artist => artist.name).join(', '),
        }));
        setSongSearchResults(results);
      } catch (error) {
        console.error('Error searching Spotify:', error);
        Toast.show({ type: 'error', text1: 'Song search failed.' });
      } finally {
        setIsSearchingSong(false);
      }
    });
  };

  const selectSong = (song) => {
    setProfileData(p => ({ ...p, song }));
    setSongSearchResults([]); // Clear search results
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backArrow}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>{isMyProfile ? "Edit Profile" : `${profileData?.username || 'User'}'s Profile`}</Text>
        {isMyProfile && (
          <TouchableOpacity onPress={handleSaveChanges}>
            <Text style={styles.saveButton}>Save</Text>
          </TouchableOpacity>
        )}
      </View>

      {loading ? <ActivityIndicator style={{ marginTop: 20 }} /> : (
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        {/* Profile Animal Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Profile Animal</Text>
          <View style={styles.animalDisplay}>
            <Image source={ANIMAL_IMAGES[profileData?.profileAnimal?.base || 'capybara']} style={styles.animalBaseImage} />
            {profileData?.profileAnimal?.hat && profileData?.profileAnimal?.hat !== 'None' && (
              <Image source={HAT_IMAGES[profileData.profileAnimal.hat]} style={styles.hatImage} />
            )}
          </View>
          {isMyProfile && (
            <>
              <Text style={[styles.subSectionTitle, { color: colors.subtext }]}>Animal</Text>
              <View style={styles.selectorGrid}>
                {PRESET_ANIMALS.map(animal => (
                  <TouchableOpacity key={animal} style={[styles.selectorButton, { backgroundColor: colors.background }, profileData?.profileAnimal?.base === animal && styles.selectedButton]} onPress={() => setProfileData(p => ({ ...p, profileAnimal: { ...p.profileAnimal, base: animal } }))}>
                    <Image source={ANIMAL_IMAGES[animal]} style={styles.selectorImage} />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[styles.subSectionTitle, { color: colors.subtext }]}>Hat</Text>
              <View style={styles.selectorGrid}>
                {ACCESSORIES.hats.map(hat => (
                  <TouchableOpacity key={hat} style={[styles.selectorButton, { backgroundColor: colors.background }, profileData?.profileAnimal?.hat === hat && styles.selectedButton]} onPress={() => setProfileData(p => ({ ...p, profileAnimal: { ...p.profileAnimal, hat } }))}>
                    {hat === 'None' ? <Text style={[styles.selectorText, { color: colors.text }]}>None</Text> : <Image source={HAT_IMAGES[hat]} style={styles.selectorImage} />}
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}
        </View>

        {/* Bio Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Bio</Text>
          <TextInput
            style={[styles.bioInput, { borderColor: colors.border, color: colors.text, backgroundColor: isMyProfile ? colors.background : colors.surface }]}
            value={profileData?.bio || ''}
            onChangeText={(text) => setProfileData(p => ({ ...p, bio: text }))}
            placeholder="Tell everyone a little about yourself..."
            placeholderTextColor={colors.subtext}
            maxLength={400}
            multiline
            editable={isMyProfile}
          />
          {isMyProfile && <Text style={[styles.charCount, { color: colors.subtext }]}>{400 - (profileData?.bio?.length || 0)} characters remaining</Text>}
        </View>

        {/* Music Section */}
        <View style={[styles.section, { backgroundColor: colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>My Favorite Song</Text>
          {profileData?.song ? (
            <View style={styles.songDisplay}>
              <View style={styles.songContainer}>
                <Text style={[styles.songTitle, { color: colors.text }]}>{profileData.song.title}</Text>
                <Text style={[styles.songArtist, { color: colors.subtext }]}>{profileData.song.artist}</Text>
              </View>
            </View>
          ) : (
            <Text style={{ color: colors.subtext }}>No song selected.</Text>
          )}
          {isMyProfile && !songSearchResults.length && (
              <TouchableOpacity style={styles.searchSongButton} onPress={handleSearchSong}>
                <Text style={styles.searchSongText}>Search for a Song</Text>
              </TouchableOpacity>
            )}
        </View>

        {isSearchingSong && <ActivityIndicator style={{ marginVertical: 10 }} />}
        {songSearchResults.length > 0 && (
          <View style={[styles.section, { backgroundColor: colors.surface }]}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Search Results</Text>
            <View>
              {songSearchResults.map((item, index) => (
                <View key={`${item.title}-${index}`} style={[styles.songResultItem, { borderBottomColor: colors.border }]}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => selectSong(item)}>
                    <Text style={[styles.songTitle, { color: colors.text }]}>{item.title}</Text>
                    <Text style={[styles.songArtist, { color: colors.subtext }]}>{item.artist}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end', // Already correct
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
  },
  backArrow: { fontSize: 16, color: '#0078d4', paddingBottom: 2, flex: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', flex: 2, textAlign: 'center' },
  saveButton: { fontSize: 16, color: '#0078d4', fontWeight: '600', flex: 1, textAlign: 'right' },
  scrollContainer: { padding: 10 },
  section: {
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  animalDisplay: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    width: 150,
    height: 150,
    marginBottom: 10,
    marginTop: 40,
    alignSelf: 'center',
  },
  animalBaseImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  subSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  selectorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  selectorButton: {
    padding: 10,
    width: 70,
    height: 70,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 4,
  },
  selectedButton: {
    backgroundColor: '#0078d4',
    borderWidth: 2,
    borderColor: '#fff',
  },
  selectorText: {
    fontSize: 16,
  },
  selectorImage: {
    width: '90%',
    height: '90%',
    resizeMode: 'contain',
  },
  hatImage: {
    position: 'absolute',
    top: -80,
    left: -2,// Adjust these values to position the hat correctly
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  bioInput: {
    height: 120,
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    textAlignVertical: 'top',
  },
  charCount: {
    textAlign: 'right',
    marginTop: 4,
    fontSize: 12,
  },
  songDisplay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  songContainer: {
    marginBottom: 15,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  songArtist: {
    fontSize: 14,
  },
  searchSongButton: {
    backgroundColor: '#1DB954', // Spotify Green
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
  },
  searchSongText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  songResultItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});