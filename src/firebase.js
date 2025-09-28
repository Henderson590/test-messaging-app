// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// 🔥 Paste your own config here:
const firebaseConfig = {
    apiKey: "AIzaSyAdPuhYZUz_RJJq7IFhzbKWQyy7mFiPYJ4",
    authDomain: "test-messaging-app-ad271.firebaseapp.com",
    projectId: "test-messaging-app-ad271",
    storageBucket: "test-messaging-app-ad271.appspot.com",
    messagingSenderId: "745704250467",
    appId: "1:745704250467:web:9efd448b732a9367c82c56",
    measurementId: "G-TKQQYG0X7X"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services so you can use them in other files
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
