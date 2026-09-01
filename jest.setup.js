// Test environment defaults.
//
// lib/env.js reads EXPO_PUBLIC_* at import time. Tests exercise the offline
// paths, so Gemini is deliberately left unconfigured here - generateChatReply
// should fall back to the local engine without touching the network.
process.env.EXPO_PUBLIC_FIREBASE_API_KEY = 'test-api-key';
process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN = 'test.firebaseapp.com';
process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID = 'test-project';
process.env.EXPO_PUBLIC_FIREBASE_APP_ID = 'test-app-id';
delete process.env.EXPO_PUBLIC_GEMINI_API_KEY;

// React Native's Animated loops keep ticking after a test's act() block, which
// produces "not wrapped in act(...)" warnings that are noise, not failures.
const originalError = console.error;
console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes('not wrapped in act')) return;
  originalError(...args);
};
