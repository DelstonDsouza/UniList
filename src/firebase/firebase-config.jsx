// src/firebase/firebase-config.jsx
import { initializeApp } from "firebase/app"
import { getAuth } from "firebase/auth"
import { getDatabase } from "firebase/database"

const firebaseConfig = {
  apiKey:            "AIzaSyCJaEs-mEGvjW-2fijYyNtc10cA0gWPM3w",
  authDomain:        "ridemate-10561.firebaseapp.com",
  projectId:         "ridemate-10561",
  storageBucket:     "ridemate-10561.firebasestorage.app",
  messagingSenderId: "189839983634",
  appId:             "1:189839983634:web:c0bc8f667622918bd244cb",
  databaseURL:       "https://ridemate-10561-default-rtdb.firebaseio.com",
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db   = getDatabase(app)

export default app