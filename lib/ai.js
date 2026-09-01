// lib/ai.js
//
// The app's only AI entry point. Screens call generateChatReply() and
// generateWellnessInsight() and never talk to a model SDK directly.
//
// MOVING THIS TO A BACKEND PROXY
// ------------------------------
// Every network call funnels through requestCompletion() below. To stop
// shipping the API key in the client, replace the body of that one function
// with a fetch() to your own endpoint that forwards to Gemini server-side.
// Nothing else in the codebase has to change.

import { GoogleGenerativeAI, HarmBlockThreshold, HarmCategory } from '@google/generative-ai';

import { geminiConfig, isGeminiConfigured } from './env';
import { SATTVA_SYSTEM_PROMPT, WELLNESS_INSIGHT_PROMPT } from './prompts';

const REQUEST_TIMEOUT_MS = 15000;
const MAX_HISTORY_TURNS = 12; // ~6 exchanges of context

// Gemini's own filters are relaxed one notch: this app discusses distress by
// design, and a hard block would fail the user exactly when they need a reply.
// Genuinely unsafe content is still blocked, and crisis handling runs in
// lib/safety.js *before* anything reaches the model.
const SAFETY_SETTINGS = [
  HarmCategory.HARM_CATEGORY_HARASSMENT,
  HarmCategory.HARM_CATEGORY_HATE_SPEECH,
  HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
  HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH }));

let client = null;

const getClient = () => {
  if (!isGeminiConfigured()) return null;
  if (!client) client = new GoogleGenerativeAI(geminiConfig.apiKey);
  return client;
};

const withTimeout = (promise, ms) =>
  Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI request timed out after ${ms}ms`)), ms)
    ),
  ]);

/**
 * Gemini requires history to start with a 'user' turn and to alternate
 * strictly. Our transcript can start with an assistant greeting and can
 * contain runs of the same role (e.g. two mood-selection replies in a row),
 * so it is normalised here.
 *
 * @param {Array<{text: string, isUser: boolean}>} messages
 * @returns {Array<{role: 'user'|'model', parts: Array<{text: string}>}>}
 */
export const toGeminiHistory = (messages = []) => {
  const turns = [];

  for (const msg of messages) {
    const text = typeof msg?.text === 'string' ? msg.text.trim() : '';
    if (!text) continue;

    const role = msg.isUser ? 'user' : 'model';
    const previous = turns[turns.length - 1];

    if (previous && previous.role === role) {
      // Merge consecutive same-role turns rather than dropping content.
      previous.parts[0].text += `\n\n${text}`;
    } else {
      turns.push({ role, parts: [{ text }] });
    }
  }

  // Drop any leading model turns so the history opens with 'user'.
  while (turns.length && turns[0].role === 'model') turns.shift();

  // Keep the tail (most recent context) and re-check the leading role, since
  // slicing can expose a model turn at the front.
  const trimmed = turns.slice(-MAX_HISTORY_TURNS);
  while (trimmed.length && trimmed[0].role === 'model') trimmed.shift();

  return trimmed;
};

/**
 * The single network seam. Swap this for a fetch() to your own proxy to move
 * the API key off the client.
 */
const requestCompletion = async ({ systemInstruction, history = [], message }) => {
  const genAI = getClient();
  if (!genAI) throw new Error('Gemini is not configured');

  const model = genAI.getGenerativeModel({
    model: geminiConfig.model,
    systemInstruction,
    safetySettings: SAFETY_SETTINGS,
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      maxOutputTokens: 220,
    },
  });

  const chat = model.startChat({ history });
  const result = await withTimeout(chat.sendMessage(message), REQUEST_TIMEOUT_MS);

  const text = result?.response?.text?.();
  if (!text || !text.trim()) {
    throw new Error('Model returned an empty response');
  }
  return text.trim();
};

/**
 * Main chat entry point.
 *
 * @param {object} params
 * @param {string} params.message         - what the user just sent
 * @param {string|null} params.mood       - currently selected mood, if any
 * @param {Array} params.history          - prior messages ({text, isUser})
 * @returns {Promise<{text: string, source: 'gemini'|'offline'}>}
 *          Always resolves. Network/quota/config failures degrade to the
 *          offline engine so the demo never dead-ends on a blank reply.
 */
export const generateChatReply = async ({ message, mood = null, history = [] }) => {
  if (isGeminiConfigured()) {
    try {
      const systemInstruction = mood
        ? `${SATTVA_SYSTEM_PROMPT}\n\nThe user has just logged their current mood as "${mood}". Let that inform your tone without mentioning it mechanically.`
        : SATTVA_SYSTEM_PROMPT;

      const text = await requestCompletion({
        systemInstruction,
        history: toGeminiHistory(history),
        message,
      });
      return { text, source: 'gemini' };
    } catch (err) {
      console.warn('[Sattva AI] Gemini chat failed, using offline reply:', err.message);
    }
  }

  return { text: offlineReply(message, mood), source: 'offline' };
};

/**
 * Stats screen insight. Receives aggregate numbers only - never chat text,
 * journal entries, cycle data or dates.
 *
 * @param {object} summary
 * @param {number} summary.averageMood     - 1..5
 * @param {string} summary.trend           - e.g. "+12%"
 * @param {string} summary.primaryMood
 * @param {number} summary.daysLogged
 * @param {string|null} summary.hardestDay - weekday name or null
 * @returns {Promise<{text: string, source: 'gemini'|'offline'}>}
 */
export const generateWellnessInsight = async (summary, offlineFallback) => {
  if (isGeminiConfigured()) {
    try {
      const facts = [
        `Average mood index: ${summary.averageMood}/5`,
        `Week-over-week change: ${summary.trend}`,
        `Most frequent mood: ${summary.primaryMood}`,
        `Days logged in the last 7: ${summary.daysLogged}`,
        summary.hardestDay ? `Lowest-scoring weekday: ${summary.hardestDay}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      const text = await requestCompletion({
        systemInstruction: WELLNESS_INSIGHT_PROMPT,
        history: [],
        message: facts,
      });
      return { text, source: 'gemini' };
    } catch (err) {
      console.warn('[Sattva AI] Gemini insight failed, using local report:', err.message);
    }
  }

  return { text: offlineFallback, source: 'offline' };
};

// ---------------------------------------------------------------------------
// Offline reply engine
//
// Used when no Gemini key is set, or when a request fails. This is the old
// in-app matcher, kept as a safety net but rewritten to match on word
// boundaries. The previous version used bare substring checks, so "I feel like
// this is too much" matched 'hi' and answered with a cheerful greeting.
// ---------------------------------------------------------------------------

/** Matches whole words only: "hi" hits "hi there" but not "this" or "history". */
const hasWord = (text, words) => new RegExp(`\\b(${words.join('|')})\\b`, 'i').test(text);

/** Matches word-initial stems: "breath" hits "breathe"/"breathing", not "unbreathable". */
const hasStem = (text, stems) => new RegExp(`\\b(${stems.join('|')})`, 'i').test(text);

const MOOD_RESPONSES = {
  Happy: {
    default: [
      "That's wonderful! What's making you feel particularly happy today?",
      "I love seeing you in good spirits. Would you like to share more?",
      "Your positive energy comes through. What's been the highlight of your day?",
    ],
    why: [
      "It's great that you're feeling happy. Understanding what lifts us can help us find our way back here again.",
      "Exploring what brings us joy helps us appreciate these moments. Would you like to share what's behind it?",
    ],
    help: [
      "While you're feeling good, this could be a lovely time to plan something you'll look forward to.",
      "It's wonderful that you're feeling happy. Would you like to explore ways to hold onto this energy?",
    ],
  },
  Sad: {
    default: [
      "I hear you, and it's okay to feel sad. Would you like to talk about what's weighing on you?",
      "I'm here to listen without judgement. What's on your mind?",
      "Sometimes putting feelings into words lightens the load a little. What's been going on?",
    ],
    why: [
      "It's brave to sit with these feelings. Would you like to talk about what might be behind the sadness?",
      "Naming what hurts is often the first step. What do you think set this off?",
    ],
    help: [
      "Let's take it gently. Would you like to try a short grounding exercise together?",
      "There are a few small things that can help. Would you like to explore some of them?",
    ],
  },
  Stressed: {
    default: [
      "Stress can feel like a lot to carry. What's pressing on you most right now?",
      "Let's slow the pace down a little. Would you like to talk through what's stressing you?",
      "Breaking a big worry into pieces often makes it more manageable. What's on your mind?",
    ],
    why: [
      "Understanding our triggers makes them easier to handle. What do you think is driving the stress?",
      "Let's look at what's underneath this. Is it one specific thing, or several stacking up?",
    ],
    help: [
      "Box breathing in the Exercises tab is a good place to start. Would you like to try it?",
      "There are a few ways to take the edge off. Would you like to explore some together?",
    ],
  },
  Calm: {
    default: [
      "It's good that you're feeling calm. What's helping you hold onto that?",
      "Moments of calm are worth noticing. How did you get here today?",
      "That's a steady place to be. What helped you settle?",
    ],
    why: [
      "Knowing what brings us calm helps us find it again. What worked for you?",
      "It's useful to recognise what settles us. Would you like to unpack what contributed?",
    ],
    help: [
      "Would you like to try something that helps make this calm last a little longer?",
      "This is a good foundation. Would you like to explore ways to build on it?",
    ],
  },
  Neutral: {
    default: [
      "Neutral can be a good place to think from. How would you like to feel today?",
      "Sometimes steady is exactly what's needed. What's on your mind?",
      "This could be a good moment to set an intention. What would you like to focus on?",
    ],
    why: [
      "Neutral moments leave room for reflection. Would you like to explore what you're thinking about?",
      "Sometimes an even keel helps us see things more clearly. What's coming up for you?",
    ],
    help: [
      "Would you like to explore something small that might shift the day in a good direction?",
      "This could be a nice time to try something new. Would you like a suggestion?",
    ],
  },
};

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/**
 * Rule-based reply used when Gemini is unavailable.
 * @param {string} userMessage
 * @param {string|null} currentMood
 * @returns {string}
 */
export const offlineReply = (userMessage, currentMood) => {
  const msg = String(userMessage || '');

  if (hasWord(msg, ['hi', 'hey', 'hello', 'hiya', 'howdy'])) {
    return 'Hello. How are you doing today?';
  }

  if (hasWord(msg, ['bye', 'goodbye', 'goodnight'])) {
    return "Take care of yourself. I'm here whenever you need to talk.";
  }

  if (hasStem(msg, ['breath', 'inhale', 'exhale'])) {
    return 'Slow breathing settles the nervous system faster than almost anything else. The Exercises tab has a guided box breathing timer if you want to try it now.';
  }

  if (hasStem(msg, ['ground', 'anxious', 'anxiety', 'panic', 'overwhelm'])) {
    return "When everything feels like too much, anchoring in your senses helps. There's a 5-4-3-2-1 grounding exercise in the Exercises tab.";
  }

  if (hasStem(msg, ['meditat', 'mindful']) || hasWord(msg, ['quiet', 'still'])) {
    return "A few quiet minutes can reset the whole day. There's a meditation timer in the Exercises tab whenever you want it.";
  }

  if (hasStem(msg, ['journal', 'writing', 'write about'])) {
    return "Writing things down often makes them feel less tangled. Try one line about what's sitting heaviest right now.";
  }

  if (hasStem(msg, ['statistic', 'trend', 'progress']) || hasWord(msg, ['stats', 'chart', 'charts'])) {
    return 'You can see how your mood has moved over the week in the Stats tab, using the chart icon in the header.';
  }

  if (hasStem(msg, ['menstrua', 'ovulat']) || hasWord(msg, ['cycle', 'period', 'periods'])) {
    return 'You can log your cycle alongside your mood in the Calendar tab, and it will show predicted dates too.';
  }

  const moodSet = MOOD_RESPONSES[currentMood] || MOOD_RESPONSES.Neutral;

  if (hasWord(msg, ['why'])) return pick(moodSet.why);
  if (hasWord(msg, ['help', 'advice']) || /what should i do/i.test(msg)) return pick(moodSet.help);

  return pick(moodSet.default);
};

export { isGeminiConfigured };
