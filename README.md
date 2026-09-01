# Sattva AI

**An AI-powered mental wellness companion built with React Native, Expo, Google Gemini and Firebase.**

Sattva AI is a cross-platform mobile app (iOS, Android and web) that combines an empathetic AI chat companion with mood tracking, cycle logging, guided coping exercises and a wellness analytics dashboard — with a deterministic crisis-safety layer that runs independently of the AI.

---

## Problem statement

Mental wellbeing support is hard to reach at the moment it is needed. Professional help involves cost, waiting lists and scheduling; meanwhile the day-to-day work of noticing patterns, regulating stress and building small habits goes untracked. Existing mood-tracking apps record data but rarely help you interpret it, and general-purpose chatbots will happily role-play as a therapist — which is exactly what a wellbeing tool should not do.

Sattva AI aims at the gap in between: an always-available, judgement-free companion that listens, points toward concrete coping tools, tracks emotional patterns over time, and is explicit about not being a clinician — escalating to real human crisis resources when the conversation calls for it.

---

## Features

| Area | What it does |
|---|---|
| **AI companion** | Conversational support powered by Google Gemini, with a purpose-written wellness persona and short-term conversation memory. Degrades gracefully to an on-device reply engine when offline or unconfigured. |
| **Crisis safety layer** | Deterministic pattern matching that runs *before* the AI. Surfaces real crisis resources (988, Crisis Text Line, international helpline finder) and replies with a fixed, reviewed message rather than improvising. |
| **Mood tracking** | Five-mood daily logging from the home screen or the calendar, stored one entry per user per day. |
| **Calendar** | Colour-coded mood history plus menstrual cycle logging with period, fertile-window and ovulation predictions derived from your configured cycle length. |
| **Coping exercises** | Animated box-breathing timer, interactive 5-4-3-2-1 grounding checklist, and a meditation timer with rotating prompts. Links out to curated relaxation playlists. |
| **Stats dashboard** | On-device charts for today and the last 7 days, mood distribution donut, quick stats, plus an AI-written wellness insight that is clearly labelled and separated from the calculated numbers. |
| **Voice input** | Speech-to-text on web (Chromium) and native (development builds), with graceful fallback to typing wherever it is unsupported. |

---

## Architecture

Sattva AI is a **client-only application**. There is no custom backend server — the Expo app talks directly to Firebase for data and to Google Gemini for AI.

```
┌─────────────────────────────────────────────────────────┐
│                  Expo / React Native app                 │
│                                                          │
│  index.js → App.js                                       │
│    └─ GestureHandlerRootView → SafeAreaProvider           │
│         └─ ErrorBoundary → RootNavigator                  │
│              │                                            │
│              ├─ not configured ──→ SetupScreen            │
│              ├─ signed out ──────→ AuthScreen             │
│              └─ signed in ───────→ Stack Navigator        │
│                     ├─ HomeScreen      (chat + mood)      │
│                     ├─ CalendarScreen  (mood + cycle)     │
│                     ├─ ExercisesScreen (breathing etc.)   │
│                     └─ StatsScreen     (charts + insight) │
│                                                          │
│  lib/                                                    │
│    env.js      single source of config (EXPO_PUBLIC_*)   │
│    ai.js       Gemini provider + offline fallback        │
│    prompts.js  system prompts / AI persona               │
│    safety.js   crisis detection + resources              │
│  firebase.js   Firestore + Auth bootstrap                │
│  speech.js     cross-platform speech-to-text hook        │
└───────────────┬─────────────────────────┬────────────────┘
                │                         │
       ┌────────▼────────┐      ┌─────────▼──────────┐
       │    Firebase     │      │   Google Gemini    │
       │  Auth (email)   │      │  generateContent   │
       │  Cloud Firestore│      └────────────────────┘
       └─────────────────┘
```

### Key design decisions

**One AI seam.** Every model call funnels through `requestCompletion()` in `lib/ai.js`. To move the API key off the client, replace the body of that single function with a `fetch()` to your own proxy — nothing else in the codebase changes.

**Safety is not delegated to the model.** `lib/safety.js` runs before any message reaches Gemini. A language model is never the component deciding whether someone is at risk, and the crisis reply is a fixed reviewed string rather than generated text.

**AI failure is never a dead end.** If Gemini is unconfigured, rate-limited, offline or slow (15s timeout), `generateChatReply()` falls back to an on-device rule-based engine and tags the reply `offline`. The app is fully demoable with no API key at all.

**Calculated vs. interpreted data are visually separated.** On the Stats screen, charts and quick stats are computed on-device from your logs. The AI insight sits in its own card with an `AI generated` / `On-device` badge, so it is never mistaken for a measurement.

**Minimal data leaves the device for AI insights.** The Stats insight request sends only aggregate numbers — average mood index, week-over-week trend, most frequent mood, days logged, lowest-scoring weekday. No message text, no journal content, no cycle data, no dates.

---

## Technology stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.76.9 via Expo SDK 52 |
| Language | JavaScript (ES2021), React 18.3.1 |
| Navigation | React Navigation 6 (stack) |
| AI | Google Gemini via `@google/generative-ai` |
| Auth | Firebase Authentication (email/password) |
| Database | Cloud Firestore |
| Charts | `react-native-chart-kit` + `react-native-svg` |
| Calendar | `react-native-calendars` |
| Voice | Web Speech API (web) / `@react-native-voice/voice` (native) |
| Persistence | `@react-native-async-storage/async-storage` (auth sessions) |
| Testing | Jest + `jest-expo` + `react-test-renderer` |
| Linting | ESLint + `eslint-config-expo` |

---

## AI integration

Configured in `lib/ai.js` and `lib/prompts.js`.

- **Model:** `gemini-2.0-flash` by default, overridable via `EXPO_PUBLIC_GEMINI_MODEL`.
- **Persona:** calm, supportive, non-judgemental, friendly, emotionally intelligent, concise (2–4 sentences, no markdown — it is rendering in a chat bubble).
- **Boundaries encoded in the system prompt:** never claims to be a therapist or doctor, never diagnoses, never names conditions, never gives medical or medication advice, does not minimise, and redirects off-topic requests back to wellbeing.
- **Context:** the last 12 conversational turns are passed to the model. History is normalised first — Gemini requires strictly alternating turns beginning with `user`, while the app transcript can open with an assistant message and contain same-role runs.
- **Current mood** is folded into the system instruction rather than the visible transcript.
- **Safety settings** are set to `BLOCK_ONLY_HIGH`. This app discusses distress by design, and a hard block would fail the user precisely when it matters; genuinely unsafe content is still filtered, and crisis handling runs upstream regardless.
- **Timeout:** 15 seconds, after which the offline engine takes over.

Verify your key without launching the app:

```bash
npm run check:ai
```

This validates the key, lists the models it can actually reach, warns if your configured model is unavailable (with suggestions), and sends one real test prompt.

---

## Firebase usage

**Authentication** — email/password. On native, sessions are persisted through AsyncStorage so users stay logged in across app restarts; on web, Firebase's own browser persistence is used.

**Cloud Firestore collections**

| Collection | Document ID | Purpose |
|---|---|---|
| `messages` | auto | Chat transcript. Fields: `userId`, `text`, `isUser`, `timestamp`, `reactions[]` |
| `moods` | `{uid}_{YYYY-MM-DD}` | One mood entry per user per day. Fields: `userId`, `date`, `mood`, `timestamp` |
| `cycle_logs` | `{uid}_{YYYY-MM-DD}` | Period/flow/symptom entries. Fields: `userId`, `date`, `isPeriodStart`, `flow`, `symptoms[]`, `timestamp` |
| `cycle_settings` | `{uid}` | Cycle preferences. Fields: `cycleLength`, `periodLength` |

Security rules (`firestore.rules`) restrict every read and write to the document's own owner. Nothing is world-readable.

---

## Installation

**Prerequisites:** Node.js 18+, npm, and either the Expo Go app on a phone or a browser for the web demo.

```bash
git clone https://github.com/ksharmistha/Sattva-AI.git
cd Sattva-AI
npm install
cp .env.example .env
```

Then fill in `.env` (see below) and start the app.

---

## Environment variables

All configuration lives in `.env`, which is gitignored. Copy `.env.example` and fill it in.

| Variable | Required | Notes |
|---|---|---|
| `EXPO_PUBLIC_GEMINI_API_KEY` | No | Free from [Google AI Studio](https://aistudio.google.com/app/apikey). Without it the app runs on the offline reply engine. |
| `EXPO_PUBLIC_GEMINI_MODEL` | No | Defaults to `gemini-2.0-flash`. |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | **Yes** | Firebase Console → Project settings → Your apps → Web app |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | **Yes** | |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | **Yes** | |
| `EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET` | No | |
| `EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | No | |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | **Yes** | |
| `EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID` | No | |

If a required Firebase value is missing, the app shows a **setup screen** naming the missing keys instead of failing with an opaque error.

> **Security note.** The `EXPO_PUBLIC_` prefix means these values are inlined into the client bundle and are readable by anyone who downloads the app. For Firebase web config this is expected and safe — Firestore security rules are the real access control. The Gemini key is the one value you would move behind a backend proxy before any public release; see *Key design decisions* above.

---

## How to run locally

```bash
npm start          # Expo dev server, then press w / i / a
```

| Command | What it does |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run web` | Run in the browser (easiest for a demo) |
| `npm run android` | Run on an Android emulator/device |
| `npm run ios` | Run on an iOS simulator/device |
| `npm test` | Run the Jest suite |
| `npm run lint` | Run ESLint |
| `npm run validate` | Lint + test |
| `npm run check:ai` | Verify the Gemini key and model |
| `npm run doctor` | Expo dependency diagnostics |
| `npm run export:web` | Produce a static web build |

---

## Firestore setup

The app needs two composite indexes and its security rules deployed. Both are committed to the repo.

**Option A — Firebase CLI (recommended)**

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # select your Firebase project
firebase deploy --only firestore:rules,firestore:indexes
```

**Option B — Firebase Console**

1. **Authentication → Sign-in method →** enable **Email/Password**.
2. **Firestore Database →** create a database.
3. **Firestore → Rules →** paste the contents of `firestore.rules` and publish.
4. **Firestore → Indexes →** add two composite indexes:
   - `messages`: `userId` ascending, `timestamp` **descending**
   - `moods`: `userId` ascending, `timestamp` **ascending**

Without the indexes, chat history and the stats dashboard will fail to load; the app detects this specific failure and tells you so in-app rather than failing silently.

---

## Testing

```bash
npm test
```

28 tests across 4 suites:

- `safety.test.js` — crisis detection: true positives, ordinary distress that must *not* trigger, and discussion-vs-disclosure cases.
- `ai.test.js` — offline reply engine word-boundary matching, Gemini history normalisation, graceful degradation.
- `gemini.test.js` — Gemini wiring against a mocked SDK: system prompt, mood injection, history sanitisation, and fallback on error/empty/timeout.
- `screens.test.js` — render smoke tests for every screen plus the full navigation tree.

See `TESTING_GUIDE.md` for the manual QA script.

---

## Known limitations

1. **The Gemini API key ships in the client bundle.** Acceptable for a local demo and a project presentation; move it behind a proxy before any public distribution. `lib/ai.js` is structured so this is a one-function change.
2. **Native voice input requires a development build.** `@react-native-voice/voice` contains native code and does not work in Expo Go. On web it requires a Chromium-based browser (Chrome/Edge); Safari and Firefox fall back to typing with an in-app notice.
3. **Crisis detection is pattern-based, not clinical.** It matches phrasing with word boundaries and stands down on discussion-style context, but it is a demo-grade heuristic — it will miss indirect phrasing and is not a risk assessment tool.
4. **Crisis resources are US-centric.** 988 and Crisis Text Line are US services; an international helpline finder is included, but the list is not localised by region.
5. **Chat history is capped at the 50 most recent messages,** and only the last 12 turns are sent to the model as context.
6. **Cycle predictions assume a regular cycle** projected from the most recent logged period. They are informational only and not a contraceptive or diagnostic aid.
7. **No offline data persistence.** Firestore offline caching is not enabled, so mood/chat history requires a connection.
8. **The web build is a phone-shaped layout** centred in a column on wide screens. It is a demo surface, not a designed desktop experience.
9. **Analytics is configured but unused** — `measurementId` is accepted but no analytics events are sent.

---

## Future improvements

- Move Gemini behind a serverless proxy (Firebase Cloud Functions) so no API key ships in the client.
- Sentiment analysis of chat messages to auto-populate mood trends rather than relying on manual logging.
- Push notifications for gentle self-care reminders.
- Journaling with AI-assisted reflection prompts.
- Region-aware crisis resources.
- Firestore offline persistence and optimistic sync.
- Export a wellness report as PDF to share with a therapist.

---

## Disclaimer

Sattva AI is a student/demonstration project. It is **not** a medical device, not a substitute for professional mental health care, and not an emergency service. If you are in crisis, contact your local emergency number or a crisis helpline.
