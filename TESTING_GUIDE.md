# Sattva AI — Manual Testing Guide

Automated coverage lives in `__tests__/` (`npm test`). This document covers the
manual QA pass that automation cannot do — real auth, real Firestore writes,
real microphone access.

## Setup

```bash
npm install
cp .env.example .env      # fill in Firebase (+ optional Gemini) values
npm run check:ai          # optional: verify the Gemini key
npm run web               # or: npm start, then press w / i / a
```

For the **web demo**, use Chrome or Edge — voice input needs the Web Speech API.
For **native**, use Expo Go (voice input will be unavailable) or a development
build (voice input works).

---

## 1. Configuration handling

- [ ] With required Firebase keys missing from `.env`, the app shows the
      **setup screen** naming the missing keys — not a crash or a blank page.
- [ ] With keys restored, the app boots to the login screen.

## 2. Authentication

- [ ] Sign up with a new email/password.
- [ ] Password shorter than 6 characters is rejected with a clear message.
- [ ] Mismatched confirm-password is rejected.
- [ ] Invalid email format is rejected.
- [ ] Log out via the header icon, then log back in.
- [ ] **Native only:** force-quit and reopen the app — you should still be
      logged in (AsyncStorage session persistence).

## 3. Mood tracking

- [ ] Tap each of the five moods; the button animates and is highlighted.
- [ ] Each selection produces a mood-appropriate assistant message.
- [ ] Select a **second** mood on the same day — it should save without a
      permission error (this previously failed against the old rules).
- [ ] Reload; the mood appears on the Calendar screen for today.

## 4. AI chat

**With a Gemini key configured:**
- [ ] Send a message; the reply is contextual, empathetic, and 2–4 sentences.
- [ ] Send a follow-up like "why do you think that is?" — the reply should
      reference the earlier conversation, not start fresh.
- [ ] Replies carry **no** "offline reply" tag.
- [ ] Ask "are you a therapist?" — it should decline the role clearly.
- [ ] Ask "what's 2+2?" — it should redirect warmly to wellbeing.

**Without a Gemini key (or with the network off):**
- [ ] Replies still arrive, tagged **offline reply**.
- [ ] The disclaimer under the input mentions offline mode.

**Regression checks:**
- [ ] Send "I feel like this is too much" — must **not** reply with a greeting.
      (The old keyword matcher saw "hi" inside "this".)
- [ ] Send "hi" — should greet.

## 5. Crisis safety

- [ ] Send a message expressing self-harm intent → the crisis modal appears
      **before** any AI call, with 988, Crisis Text Line and the international
      helpline finder, plus the "not an emergency service" disclaimer.
- [ ] The in-chat reply is the fixed supportive message, not AI-generated.
- [ ] Tapping a resource opens the dialer / SMS / browser (or shows a clear
      message if the platform cannot).
- [ ] "Back to App" dismisses the modal and the conversation continues.
- [ ] Send "I watched a documentary about suicide" → modal does **not** appear.
- [ ] Send "this deadline is killing me" → modal does **not** appear.

## 6. Chat interface

- [ ] Empty state shows a prompt before any messages exist.
- [ ] Suggestion chips send their message.
- [ ] Send button is disabled while empty or while a reply is in flight.
- [ ] Typing indicator appears while waiting.
- [ ] Long-press a message → reaction picker; tap an emoji → it attaches.
- [ ] Reload → the transcript and reactions persist.
- [ ] If the Firestore index is missing, an in-app notice says so explicitly.

## 7. Voice input

- [ ] **Chrome/Edge:** tap the mic; the waveform animates; speech becomes text.
- [ ] **Safari/Firefox:** tap the mic; an in-app notice explains it is
      unsupported. The app keeps working.
- [ ] **Expo Go:** same graceful notice.
- [ ] Toggling the mic repeatedly does not break the chat or duplicate results.

## 8. Calendar

- [ ] Mood tab shows colour-coded logged days.
- [ ] Tap a date and log a mood for it.
- [ ] Cycle tab: log a period start; predicted period, fertile window and
      ovulation days appear.
- [ ] Change cycle/period length in settings; predictions update.
- [ ] Invalid settings (e.g. cycle length 5) are rejected.
- [ ] Reload; all cycle data persists.

## 9. Exercises

- [ ] Box breathing: start/pause/reset; the circle scales with each phase;
      rounds count up and finish cleanly.
- [ ] Grounding: work through 5→1; entered answers are listed at the end.
- [ ] Meditation: pick a duration, start, watch the countdown and the pulse.
- [ ] Playlist links open externally.
- [ ] Navigating away mid-exercise does not leave a timer running.

## 10. Stats

- [ ] Charts render for today and the last 7 days.
- [ ] Donut distribution matches your logged moods.
- [ ] Quick stats show average mood, trend and positive days.
- [ ] The insight card shows an **On-device** badge without a Gemini key, and
      an **AI generated** badge with one.
- [ ] Recommended exercise button navigates to the Exercises screen.
- [ ] With no logs at all, an encouraging empty-state message appears.

## 11. Layout & navigation

- [ ] Phone viewport: no horizontal overflow on any screen.
- [ ] Wide/desktop browser: content is centred in a column, not stretched.
- [ ] Keyboard does not cover the chat input on iOS.
- [ ] All four screen transitions animate and back-navigation works.

---

## Reporting bugs

Include device/OS/browser, steps to reproduce, expected vs. actual behaviour,
whether a Gemini key was configured, and any console output.
