// lib/env.js
//
// Single source of truth for runtime configuration.
//
// IMPORTANT: every process.env read below is a STATIC property access.
// The Expo CLI inlines EXPO_PUBLIC_* variables by literal text substitution at
// bundle time, so a dynamic lookup like process.env[key] is NOT replaced and
// resolves to undefined in the app bundle. Keep these reads spelled out.
//
// Each value falls back to Constants.expoConfig.extra (populated by
// app.config.js) for setups where the variable was only present at config time.
//
// Swapping in a different config source later - or moving the Gemini key
// behind a backend proxy - is a change to this file plus lib/ai.js only.

import Constants from 'expo-constants';

const extra = Constants?.expoConfig?.extra ?? {};

/** Returns the first non-empty, trimmed string among the arguments. */
const pick = (...values) => {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return '';
};

export const firebaseConfig = {
  apiKey: pick(process.env.EXPO_PUBLIC_FIREBASE_API_KEY, extra.firebaseApiKey),
  authDomain: pick(process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN, extra.firebaseAuthDomain),
  projectId: pick(process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID, extra.firebaseProjectId),
  storageBucket: pick(process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET, extra.firebaseStorageBucket),
  messagingSenderId: pick(
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    extra.firebaseMessagingSenderId
  ),
  appId: pick(process.env.EXPO_PUBLIC_FIREBASE_APP_ID, extra.firebaseAppId),
  measurementId: pick(
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
    extra.firebaseMeasurementId
  ),
};

export const geminiConfig = {
  apiKey: pick(process.env.EXPO_PUBLIC_GEMINI_API_KEY, extra.geminiApiKey),
  model: pick(process.env.EXPO_PUBLIC_GEMINI_MODEL, extra.geminiModel) || 'gemini-2.0-flash',
};

// The fields Firebase actually needs to initialise.
const REQUIRED_FIREBASE_KEYS = ['apiKey', 'authDomain', 'projectId', 'appId'];

export const isFirebaseConfigured = () =>
  REQUIRED_FIREBASE_KEYS.every((key) => Boolean(firebaseConfig[key]));

export const isGeminiConfigured = () => Boolean(geminiConfig.apiKey);

// Drives the setup screen in App.js so a misconfigured checkout fails loudly
// instead of silently half-working.
export const missingFirebaseKeys = () =>
  REQUIRED_FIREBASE_KEYS.filter((key) => !firebaseConfig[key]);
