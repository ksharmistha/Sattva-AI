# Sattva AI Roadmap

## 🚀 Project Overview

Sattva AI is an AI-powered mental wellness application designed to help users manage their emotional well-being through mood tracking, relaxation exercises, menstrual cycle tracking, and AI-driven sentiment analysis. It integrates with wearable devices and ensures data security while providing professional redirection for severe cases.

---

## 📅 Roadmap Overview

This roadmap outlines the development stages of Sattva AI, focusing on building a functional MVP for a rapid development cycle.

### **Phase 1: Project Setup & Firebase Integration (Hours)**

* ✅ Define core features & architecture
* ✅ Set up GitHub repository
* ✅ Initialize React Native project with Expo (blank template)
* ✅ Set up Firebase project (Authentication, Firestore)
    * ✅ Follow Firebase Console instructions for Web SDK setup (using npm).
    * ✅ Install Firebase SDK (`npm install firebase`).
    * ✅ Create `firebase.js` with correct configuration.
    * ✅ Verify Firebase setup.
* ✅ Install necessary dependencies (navigation, UI library, voice).

### **Phase 2: Core Features Development (Several Hours)**

* ✅ Implement Mood Tracker UI:
    * ✅ Create mood buttons and display.
    * ✅ Store mood data in Firestore.
* ✅ Implement Calendar UI (Menstrual Tracking):
    * ✅ Install `react-native-calendars`.
    * ✅ Create `CalendarScreen.js`.
    * ✅ Implement date marking and Firestore storage.
    * ✅ Add navigation from `App.js` to `CalendarScreen.js`.
* ✅ Implement basic Voice Chat:
    * ✅ Install `@react-native-voice/voice`.
    * ✅ Implement voice input and text display.
* ✅ Basic Navigation Setup:
    * ✅ Install `@react-navigation/native` and `@react-navigation/stack`.
    * ✅ Setup navigation between main app screen and calendar screen.

### **Phase 3: Testing & Deployment Checklist (Updated)**

* 🔄 Test Mood Tracker functionality
    * Verify correct mood selection and display
    * Confirm real-time updates in Firestore
    * Test error handling for failed saves
    * Validate timestamp accuracy
    * Check mood history display

* 🔄 Test Calendar functionality
    * Verify date selection and marking
    * Confirm cycle predictions are accurate
    * Test data persistence across app restarts
    * Validate date format consistency
    * Check calendar navigation and interactions

* 🔄 Test Voice Chat functionality
    * Test voice recognition accuracy
    * Verify proper microphone permissions
    * Confirm text-to-speech conversion
    * Test error handling for voice recognition failures
    * Note: Ensure testing on physical devices, not web

* 🔄 Cross-Platform Testing
    * Test on Android emulator
    * Test on iOS simulator (if available)
    * Test on physical Android device
    * Test on physical iOS device (if available)
    * Verify consistent UI across platforms

* 🔄 Performance Optimization
    * Check app launch time
    * Monitor Firebase query performance
    * Optimize image assets
    * Implement proper loading states
    * Add error boundaries

* 🔄 Security Review
    * Verify Firebase security rules
    * Check authentication flow
    * Validate data access permissions
    * Secure API keys and credentials
    * Test user data isolation

* 🔄 Documentation
    * Update README with setup instructions
    * Document known limitations
    * Add troubleshooting guide
    * Include testing procedures
    * Document Firebase structure

* 🔄 Final Deployment Prep
    * Version number update
    * Generate release builds
    * Test production builds
    * Prepare app store assets
    * Create deployment checklist

---

## 🛠️ Tech Stack

* **Frontend:**
    * React Native (with Expo)
    * React Native Paper/Elements (optional UI library)
    * `@react-native-voice/voice`
    * `react-native-calendars`
    * `@react-navigation/native` and `@react-navigation/stack`
* **Backend:**
    * Firebase (Firestore, Authentication)
* **Sentiment Analysis:**
    * (Placeholder for MVP - simulate locally or plan for Firebase Function integration)

---

## 📝 Notes

* Prioritize core features for MVP.
* Focus on rapid development and testing.
* Use `console.log()` for debugging.
* Firebase Firestore and Authentication are the primary backend services.
* Voice chat functionality will not work on Expo Web.
* Testing on real devices is recommended for final verification.