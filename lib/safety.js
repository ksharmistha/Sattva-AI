// lib/safety.js
//
// Crisis detection. Deliberately kept as a separate, deterministic layer that
// runs BEFORE anything is sent to the AI - we never want the model to be the
// thing deciding whether someone is at risk.
//
// Scope: this is a student/demo project. The goal is to surface real crisis
// resources on a clear signal, not to perform clinical risk assessment.

/**
 * TIER 1 - unambiguous first-person disclosure.
 *
 * These phrases are self-referential ("myself", "my life", "I want to die"),
 * so there is no realistic reading in which the speaker is discussing someone
 * else. They ALWAYS fire. No context check can suppress them.
 *
 * This is deliberate. An earlier version ran a single negation pass over the
 * whole message, which meant one stray word - "heard", "saw", "friend",
 * "watched" - anywhere in the text silently disabled detection. Messages like
 * "I heard a voice telling me to kill myself" were missed. A safety layer must
 * fail toward showing resources, never away from them.
 */
const CRISIS_FIRST_PERSON = [
  /\bkill(ing)?\s+(myself|my\s?self)\b/i,
  /\bend(ing)?\s+(my\s+life|it\s+all)\b/i,
  /\btak(e|ing)\s+my\s+own\s+life\b/i,
  /\bwant\s+to\s+die\b/i,
  /\bwish\s+i\s+(was|were)\s+dead\b/i,
  /\bdon'?t\s+want\s+to\s+(live|be\s+here|wake\s+up|exist)\b/i,
  /\bbetter\s+off\s+(dead|without\s+me)\b/i,
  /\bno\s+(reason|point)\s+(to|in)\s+(living|being\s+here)\b/i,
  /\bhurt(ing)?\s+myself\b/i,
  /\bharm(ing)?\s+myself\b/i,
  /\bcut(ting)?\s+myself\b/i,
  /\bhang(ing)?\s+myself\b/i,
  /\bend\s+myself\b/i,
  /\bnot\s+want\s+to\s+(live|be\s+here)\b/i,
];

/**
 * TIER 2 - topic words that may be discussion rather than disclosure.
 *
 * "suicide", "overdose" and "self-harm" appear in coursework, news and
 * conversations about other people. These fire unless the message reads
 * clearly as discussion, per DISCUSSION_CONTEXT below.
 */
const CRISIS_TOPIC = [
  /\bsuicid(e|al)\b/i,
  /\boverdos(e|ed|ing)\b/i,
  /\bself[\s-]?harm(ing|ed)?\b/i,
];

/**
 * Applied ONLY to Tier 2 matches. Never suppresses a first-person disclosure.
 */
const DISCUSSION_CONTEXT = [
  // Media / academic framing
  /\b(documentary|article|movie|film|book|novel|news|podcast|lyrics|essay|assignment|homework|project|presentation|research|study|studying|chapter)\b/i,
  // Explicitly about another person
  /\b(my|his|her|their|a)\s+(friend|sister|brother|mother|father|mum|mom|dad|parent|cousin|colleague|classmate|partner|neighbour|neighbor)\b/i,
  // Explicitly in the past and resolved
  /\b(used\s+to|years\s+ago|back\s+then|when\s+i\s+was\s+(a\s+)?(kid|child|younger|teen|teenager))\b/i,
  // Asking about the app/helplines rather than disclosing
  /\b(hotline|helpline|prevention|awareness|campaign|statistics)\b/i,
];

/**
 * Decides whether to surface crisis resources for a message.
 *
 * Biased toward firing: an unnecessary resources modal is a far smaller harm
 * than a missed disclosure. This is a demo-grade heuristic, not a clinical
 * risk assessment.
 *
 * @param {string} text - the raw user message
 * @returns {boolean} true when crisis resources should be shown
 */
export const detectCrisis = (text) => {
  const message = String(text || '').trim();
  if (!message) return false;

  // Tier 1 is unconditional.
  if (CRISIS_FIRST_PERSON.some((pattern) => pattern.test(message))) return true;

  // Tier 2 stands down only on a clear discussion signal.
  if (CRISIS_TOPIC.some((pattern) => pattern.test(message))) {
    return !DISCUSSION_CONTEXT.some((pattern) => pattern.test(message));
  }

  return false;
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
