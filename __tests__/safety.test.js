import { detectCrisis, CRISIS_RESOURCES, CRISIS_REPLY, NOT_AN_EMERGENCY_SERVICE } from '../lib/safety';

describe('detectCrisis — first-person disclosures (must always fire)', () => {
  const disclosures = [
    'i want to die',
    "I don't want to live anymore",
    'I have been thinking about killing myself',
    'sometimes I wish I were dead',
    'i keep hurting myself when it gets bad',
    'everyone would be better off without me',
    'I have been cutting myself again',
    'there is no point in living',
    'I want to kill my self',
    'i cant do this anymore i want to die',
    'I am going to end my life',
    "I don't want to be here anymore",
  ];

  it.each(disclosures)('fires on: %s', (text) => {
    expect(detectCrisis(text)).toBe(true);
  });
});

describe('detectCrisis — regression: context words must not suppress disclosure', () => {
  // A previous implementation ran one negation pass over the whole message, so
  // any stray "heard"/"saw"/"read"/"friend"/"watched" silently disabled
  // detection. Each of these was a missed real disclosure.
  const previouslyMissed = [
    'I heard a voice telling me to kill myself',
    'I saw no way out, I want to die',
    "I read somewhere that overdosing is painless and I'm considering it",
    'my friend is fine but I want to kill myself',
    'I watched everyone leave and now I want to end my life',
    'I studied all night and now I want to die',
    'my sister called but I still want to kill myself',
  ];

  it.each(previouslyMissed)('fires on: %s', (text) => {
    expect(detectCrisis(text)).toBe(true);
  });
});

describe('detectCrisis — topic words in clear discussion context (must not fire)', () => {
  const discussion = [
    'I watched a documentary about suicide last night',
    'I am writing an essay on suicide prevention',
    'my friend went through self harm years ago',
    'I used to self harm when I was a teen',
    'the article about overdose statistics was upsetting',
    'is there a suicide helpline in the app?',
  ];

  it.each(discussion)('stands down on: %s', (text) => {
    expect(detectCrisis(text)).toBe(false);
  });
});

describe('detectCrisis — ordinary distress (must not fire)', () => {
  const ordinary = [
    'I feel like this is too much for me right now',
    'work has been really stressful this week',
    'I am so tired of everything going wrong',
    'this deadline is killing me',
    'I could die of embarrassment',
    'my phone died again',
    'I want to dye my hair',
    'my friend said he wanted to die and I am worried',
    'I am killing it at work lately',
  ];

  it.each(ordinary)('stays quiet on: %s', (text) => {
    expect(detectCrisis(text)).toBe(false);
  });
});

describe('detectCrisis — malformed input', () => {
  it.each([['empty', ''], ['whitespace', '   '], ['null', null], ['undefined', undefined], ['number', 42]])(
    'handles %s without throwing',
    (_label, value) => {
      expect(() => detectCrisis(value)).not.toThrow();
      expect(detectCrisis(value)).toBe(false);
    }
  );
});

describe('crisis resources', () => {
  it('exposes exactly one primary action and valid link schemes', () => {
    expect(CRISIS_RESOURCES.filter((r) => r.primary)).toHaveLength(1);
    CRISIS_RESOURCES.forEach((r) => {
      expect(r.url).toMatch(/^(tel:|sms:|https:)/);
      expect(r.label.length).toBeGreaterThan(0);
      expect(r.icon.length).toBeGreaterThan(0);
    });
  });

  it('states plainly that it is not an emergency service', () => {
    expect(NOT_AN_EMERGENCY_SERVICE).toMatch(/not an emergency service/i);
  });

  it('never implies the crisis reply came from a clinician', () => {
    expect(CRISIS_REPLY).not.toMatch(/\b(diagnos|therapist|doctor|prescri)/i);
  });
});
