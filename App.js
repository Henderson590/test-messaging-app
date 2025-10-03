// App.js
import React, { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import Toast from "react-native-toast-message";
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";
import { supabase } from "./supabase";

// Screens...
import AuthScreen from "./screens/AuthScreen";
import HomeScreen from "./screens/HomeScreen";
import ChatScreen from "./screens/ChatScreen";
import StoriesScreen from "./screens/StoriesScreen";
import CameraScreen from "./screens/CameraScreen";
import UserProfileScreen from "./screens/UserProfileScreen";
import AddFriendsScreen from "./screens/AddFriendsScreen";
import CreateGroupScreen from "./screens/CreateGroupScreen";
import AppSettingsScreen from "./screens/AppSettingsScreen";

const Stack = createNativeStackNavigator();

function AppContent() {
  const [user, setUser] = useState(null);
  const { colors } = useTheme();

  useEffect(() => {
    // Initialize session from Supabase and subscribe to auth changes
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription?.unsubscribe();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          {!user ? (
            <Stack.Screen name="AuthScreen" component={AuthScreen} />
          ) : (
            <>
              <Stack.Screen name="HomeScreen" component={HomeScreen} />
              <Stack.Screen name="ChatScreen" component={ChatScreen} />
              <Stack.Screen name="StoriesScreen" component={StoriesScreen} />
              <Stack.Screen name="CameraScreen" component={CameraScreen} />
              <Stack.Screen name="UserProfileScreen" component={UserProfileScreen} />
              <Stack.Screen name="AddFriendsScreen" component={AddFriendsScreen} />
              <Stack.Screen name="CreateGroupScreen" component={CreateGroupScreen} />
              <Stack.Screen name="AppSettingsScreen" component={AppSettingsScreen} />
            </>
          )}
        </Stack.Navigator>
        <Toast />
      </NavigationContainer>
    </GestureHandlerRootView>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}
