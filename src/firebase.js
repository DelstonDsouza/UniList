// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore"
import { getStorage } from "firebase/storage"
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAWMMssj6IlmWy9RthfHwk5UP-cvokUbC8",
  authDomain: "kozhi-go.firebaseapp.com",
  projectId: "kozhi-go",
  storageBucket: "kozhi-go.firebasestorage.app",
  messagingSenderId: "491349210569",
  appId: "1:491349210569:web:fd4b86d0779b74507a6418",
  measurementId: "G-LRKC55C5KF"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
// auth.useDeviceLanguage() 

