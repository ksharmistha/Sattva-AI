// lib/safety.js
//
// Crisis detection. Deliberately kept as a separate, deterministic layer that
// runs BEFORE anything is sent to the AI - we never want the model to be the
// thing deciding whether someone is at risk.
//
// Scope: this is a student/demo project. The goal is to surface real crisis
// resources on a clear signal, not to perform clinical risk assessment.

/**
 * Phrases that indicate possible risk of self-harm or suicide.
 *
 * These are matched as whole phrases with word boundaries, not raw substrings.
 * The previous implementation used String.includes(), which fired on innocent
 * text - and, worse, missed anything phrased differently.
 */
const CRISIS_PATTERNS = [
  /\bkill(ing)?\s+(myself|my\s?self)\b/i,
  /\bend(ing)?\s+(my|it)\s+(life|all)\b/i,
  /\btake\s+my\s+own\s+life\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bwish\s+i\s+(was|were)\s+dead\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+here|wake\s+up)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+living\b/i,
  /\bhurt(ing)?\s+myself\b/i,
  /\bharm(ing)?\s+myself\b/i,
  /\bself[\s-]?harm(ing)?\b/i,
  /\bcut(ting)?\s+myself\b/i,
  /\bhang\s+myself\b/i,
  /\boverdos(e|ing)\b/i,
  /\bsuicid(e|al)\b/i,
];

/**
 * Contexts where the words above are being discussed rather than expressed.
 * Keeps the modal from firing on "I watched a documentary about suicide" or
 * "my friend said he wanted to die".
 */
const NEGATING_PATTERNS = [
  /\b(don'?t|do\s+not|never|no\s+longer|not)\s+(want|feel|think)[^.!?]{0,30}\b(die|kill\s+myself|suicidal|end\s+it)\b/i,
  /\b(my|a|his|her|their)\s+(friend|sister|brother|mother|father|mum|mom|dad|cousin|colleague|classmate)\b/i,
  /\b(read|watched|saw|heard|studying|article|documentary|movie|film|book|news|essay|assignment)\b/i,
  /\b(used\s+to|years\s+ago|when\s+i\s+was\s+(a\s+)?(kid|child|younger|teen))\b/i,
];

/**
 * Decides whether to surface crisis resources for a message.
 *
 * @param {string} text - the raw user message
 * @returns {boolean} true when crisis resources should be shown
 */
export const detectCrisis = (text) => {
  const message = String(text || '').trim();
  if (!message) return false;

  const matched = CRISIS_PATTERNS.some((pattern) => pattern.test(message));
  if (!matched) return false;

  // A match still stands down if the message reads as discussion rather than
  // disclosure. Erring toward not interrupting keeps the modal meaningful.
  if (NEGATING_PATTERNS.some((pattern) => pattern.test(message))) return false;

  return true;
};

/**
 * Crisis resources shown in the modal. US-centric because the original app
 * shipped 988 / Crisis Text Line; the international line is included so the
 * demo is not misleading outside the US.
 */
export const CRISIS_RESOURCES = [
  {
    id: 'call-988',
    label: 'Call 988 (US Suicide & Crisis Lifeline)',
    icon: 'call-outline',
    url: 'tel:988',
    primary: true,
  },
  {
    id: 'text-741741',
    label: 'Text HOME to 741741',
    icon: 'chatbubble-ellipses-outline',
    url: 'sms:741741',
  },
  {
    id: 'intl',
    label: 'Find a helpline in your country',
    icon: 'globe-outline',
    url: 'https://findahelpline.com',
  },
];

/** Shown in the crisis modal and under the chat input. */
export const NOT_AN_EMERGENCY_SERVICE =
  'Sattva AI is a wellbeing companion, not an emergency service, and cannot contact anyone on your behalf. If you are in immediate danger, please call your local emergency number.';

/** Reply the app sends in-chat when crisis language is detected. */
export const CRISIS_REPLY =
  "Thank you for telling me that. What you're carrying sounds really heavy, and you shouldn't have to hold it alone. I'm not able to give you the support you deserve right now, but people are available who can. I've opened some ways to reach them.";
