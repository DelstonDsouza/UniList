// src/firebase/firebase-config.jsx

import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

// Your Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCJaEs-mEGvjW-2fijYyNtc10cA0gWPM3w",
  authDomain: "ridemate-10561.firebaseapp.com",
  projectId: "ridemate-10561",
  storageBucket: "ridemate-10561.firebasestorage.app",
  messagingSenderId: "189839983634",
  appId: "1:189839983634:web:c0bc8f667622918bd244cb",
  measurementId: "G-0E72ED0QX2"
};

// Initialize Firebase app
const app = initializeApp(firebaseConfig);

// Initialize Authentication (REQUIRED for OTP)
export const auth = getAuth(app);

// Export app if needed elsewhere
export default app;
