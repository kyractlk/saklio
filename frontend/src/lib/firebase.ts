import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, initializeAuth, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export const firebaseConfig = {
  apiKey: "AIzaSyCyXtSVXG6Fvw3h8ZignB4WI7qjATkMRW8",
  authDomain: "sakliov2.firebaseapp.com",
  projectId: "sakliov2",
  storageBucket: "sakliov2.firebasestorage.app",
  messagingSenderId: "532195717768",
  appId: "1:532195717768:web:c7df88492929febb91653d",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

function makeAuth() {
  try {
    if (Platform.OS === "web") {
      return getAuth(app);
    }
    // Native: persist session in AsyncStorage (Expo / RN)
    // getReactNativePersistence is RN-only; fallback if Metro tree-shakes it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getReactNativePersistence } = require("firebase/auth");
    return initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });
  } catch {
    return getAuth(app);
  }
}

export const auth = makeAuth();
export const db = getFirestore(app);
export const storageBucket = getStorage(app);
export const functions = getFunctions(app, "europe-west1");

void browserLocalPersistence;
