// screens/StoryViewerScreen.js
import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';
import SupabaseService from '../services/SupabaseService';

export default function StoryViewerScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { stories = [], startIndex = 0 } = route.params || {};
  const [index, setIndex] = useState(startIndex);
  const [signedUrl, setSignedUrl] = useState(null);
  const timerRef = useRef(null);

  const current = stories[index];

  const loadUrl = async () => {
    if (!current) return;
    if (current.signed_url) {
      setSignedUrl(current.signed_url);
      return;
    }
    if (current.content_url) {
      const { signedUrl } = await SupabaseService.getSignedUrl('stories', current.content_url).then(r => ({ signedUrl: r.signedUrl }));
      setSignedUrl(signedUrl);
    }
  };

  useEffect(() => {
    loadUrl();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      if (index < stories.length - 1) setIndex(index + 1);
      else navigation.goBack();
    }, 5000);
    return () => clearTimeout(timerRef.current);
  }, [index]);

  const next = () => {
    clearTimeout(timerRef.current);
    if (index < stories.length - 1) setIndex(index + 1);
    else navigation.goBack();
  };
  const prev = () => {
    clearTimeout(timerRef.current);
    if (index > 0) setIndex(index - 1);
  };

  if (!current) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text>No story</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.leftZone} onPress={prev} />
      <TouchableOpacity style={styles.rightZone} onPress={next} />

      <Image source={{ uri: signedUrl }} style={styles.image} />

      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => navigation.goBack()}><Text style={styles.close}>×</Text></TouchableOpacity>
        <Text style={styles.title}>{current.users?.username || 'Story'}</Text>
        <View style={{ width: 24 }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  image: { flex: 1, resizeMode: 'contain' },
  leftZone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: '40%', zIndex: 2 },
  rightZone: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '60%', zIndex: 2 },
  topBar: { position: 'absolute', top: 40, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { color: '#fff', fontSize: 24 },
  title: { color: '#fff', fontSize: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
