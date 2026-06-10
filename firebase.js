// firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyCZw_u5vZS4BjNrbB3QYsX7uQqStpYD7to",
  authDomain: "sattvaai.firebaseapp.com",
  projectId: "sattvaai",
  storageBucket: "sattvaai.firebasestorage.app",
  messagingSenderId: "470484477783",
  appId: "1:470484477783:web:652bd2731fbb4645f10012",
  measurementId: "G-J4VTLJLWZS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore and Auth
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };