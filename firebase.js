// firebase.js
//
// Firebase bootstrap. Configuration comes from lib/env.js (backed by .env) -
// nothing is hardcoded here any more.
//
// Auth persistence differs by platform:
//   * web    - getAuth() already persists to IndexedDB/localStorage.
//   * native - the default is in-memory, which logged the user out on every
//              app restart. We wire AsyncStorage in explicitly so sessions
//              survive a reload.

import { Platform } from 'react-native';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, initializeAuth } from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { firebaseConfig, isFirebaseConfigured, missingFirebaseKeys } from './lib/env';

let app = null;
let db = null;
let auth = null;

// True only when Firebase actually initialised. App.js uses this to show a
// setup screen instead of crashing on a half-configured checkout.
export const firebaseReady = isFirebaseConfigured();

if (!firebaseReady) {
  console.warn(
    `[Sattva AI] Firebase is not configured. Missing: ${missingFirebaseKeys().join(', ')}. ` +
      'Copy .env.example to .env and fill in your Firebase web config.'
  );
} else {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);

  if (Platform.OS === 'web') {
    auth = getAuth(app);
  } else {
    // getReactNativePersistence only exists in the react-native build of
    // firebase/auth, so it is required lazily - a static import would resolve
    // to `undefined` in the web bundle.
    try {
      const { getReactNativePersistence } = require('firebase/auth');
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    } catch {
      // initializeAuth throws if it already ran (e.g. Fast Refresh). Falling
      // back to getAuth returns the instance that was already created.
      auth = getAuth(app);
    }
  }
}

export { db, auth };
