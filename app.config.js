// app.config.js
//
// Exported as a FUNCTION so Expo passes in the static app.json as `config` and
// we extend it. The previous version exported a plain object, which made Expo
// discard app.json entirely - silently dropping the microphone permissions
// plugin, the dark theme, newArchEnabled, and the app icon, and leaving a
// splash path (./assets/splash.png) that does not exist in the repo.
//
// Static identity/branding lives in app.json. Only environment-derived values
// and things that must be computed live here.

export default ({ config }) => ({
  ...config,

  // Mirrored into the client bundle as a fallback for lib/env.js. The primary
  // path is process.env.EXPO_PUBLIC_*, which the Expo CLI inlines from .env.
  extra: {
    ...config.extra,
    geminiApiKey: process.env.EXPO_PUBLIC_GEMINI_API_KEY,
    geminiModel: process.env.EXPO_PUBLIC_GEMINI_MODEL,
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    firebaseMeasurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  },
});
