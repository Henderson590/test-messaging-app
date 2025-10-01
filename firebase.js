// src/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  initializeAuth, 
  getReactNativePersistence, 
  getAuth 
} from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getFirestore } from "firebase/firestore";

// 🔥 Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyAdPuhYZUz_RJJq7IFhzbKWQyy7mFiPYJ4",
  authDomain: "test-messaging-app-ad271.firebaseapp.com",
  projectId: "test-messaging-app-ad271",
  storageBucket: "test-messaging-app-ad271.appspot.com",
  messagingSenderId: "745704250467",
  appId: "1:745704250467:web:9efd448b732a9367c82c56",
  measurementId: "G-TKQQYG0X7X"
};

// Initialize Firebase safely
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

// ✅ Initialize Auth with persistence
let auth;
if (getApps().length === 0) {
  // First time initialization
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  // If already initialized
  auth = getAuth(app);
}

// Export initialized services
export { auth };
export const db = getFirestore(app);
