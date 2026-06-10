# Sattva AI Testing Guide 

## Setup Requirements
- iOS or Android device
- Expo Go app installed from App Store/Play Store
- Internet connection
- Node.js installed (for developers)

## Installation Steps
1. Install Expo Go on your device
2. Open Expo Go
3. Scan the QR code from the development server
4. Wait for the app to load and initialize Firebase

## Test Scenarios 

### 1. Mood Selection & Response
- [ ] Test each mood button:
  - Happy (😊)
  - Calm (😌)
  - Neutral (😐)
  - Sad (😔)
  - Stressed (😫)
- [ ] Verify button animations work
- [ ] Check if AI responds with mood-specific message
- [ ] Test multiple mood changes

### 2. Chat Interface
- [ ] Basic Greetings:
  - Send "hi", "hello", or "hey"
  - Check AI response
- [ ] Message Types:
  - Send questions with "why"
  - Send messages asking for "help"
  - Test regular conversations
- [ ] UI Elements:
  - Message bubbles alignment
  - Text visibility on dark background
  - Loading indicators
  - Scroll behavior

### 3. Navigation & Screens
- [ ] Header Icons:
  - Calendar (slide up animation)
  - Exercises/Health (slide left animation)
  - Stats (slide down animation)
- [ ] Screen Transitions:
  - Smooth animations
  - Proper loading
  - Back navigation

### 4. Voice Button
- [ ] Tap voice button
- [ ] Verify "coming soon" message appears in chat
- [ ] Check button styling and icon

### 5. Error Handling
- [ ] Network Issues:
  - Test offline behavior
  - Firebase connection errors
- [ ] Input Validation:
  - Empty messages
  - Very long messages
  - Special characters

## Known Limitations
1. Chat Features:
   - No message persistence after reload
   - Scroll might stop after multiple messages
   - No image or file sharing

2. Technical:
   - Firebase initial connection errors
   - Limited offline functionality
   - No voice input implementation yet

## Reporting Bugs
Please include:
1. Device Details:
   - Model
   - OS version
   - Expo Go version
2. Bug Information:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Screenshots
3. Context:
   - Network condition
   - App state (fresh install/reload)

## Development Testing
```bash
# Start development server
expo start

# Run on iOS simulator
expo start --ios

# Run on Android emulator
expo start --android
```

## Contact
For technical issues:
- Create an issue in the project repository
- Include "BUG:" or "FEATURE:" in the title
- Tag with appropriate labels (UI, Chat, Firebase, etc.)
