import { offlineReply, toGeminiHistory, generateChatReply } from '../lib/ai';

describe('offlineReply word-boundary matching', () => {
  // Regression test for the original bug: String.includes('hi') matched the
  // "hi" inside "this", so distressed messages got a cheerful greeting.
  it('does not treat "this" as a greeting', () => {
    const reply = offlineReply('I feel like this is too much', 'Sad');
    expect(reply).not.toMatch(/^Hello/);
  });

  it('does not treat "history" or "shipping" as a greeting', () => {
    expect(offlineReply('my history with this is complicated', 'Neutral')).not.toMatch(/^Hello/);
    expect(offlineReply('the shipping was delayed', 'Neutral')).not.toMatch(/^Hello/);
  });

  it('still greets on a real greeting', () => {
    expect(offlineReply('hi', 'Happy')).toMatch(/^Hello/);
    expect(offlineReply('hey there', 'Happy')).toMatch(/^Hello/);
  });

  it('routes topical messages to the matching in-app tool', () => {
    expect(offlineReply('can we do some breathing', null)).toMatch(/box breathing/i);
    expect(offlineReply('I feel really anxious', null)).toMatch(/grounding/i);
    expect(offlineReply('how do I track my period', null)).toMatch(/Calendar/i);
  });

  it('falls back to mood-appropriate replies', () => {
    const sad = offlineReply('just checking in', 'Sad');
    expect(typeof sad).toBe('string');
    expect(sad.length).toBeGreaterThan(0);
  });

  it('never throws on empty input', () => {
    expect(() => offlineReply('', null)).not.toThrow();
    expect(() => offlineReply(null, undefined)).not.toThrow();
  });
});

describe('toGeminiHistory', () => {
  it('drops leading assistant turns so history starts with the user', () => {
    const history = toGeminiHistory([
      { text: 'Welcome to Sattva AI', isUser: false },
      { text: 'hello', isUser: true },
      { text: 'Hi there', isUser: false },
    ]);
    expect(history[0].role).toBe('user');
    expect(history[0].parts[0].text).toBe('hello');
  });

  it('merges consecutive same-role turns instead of dropping them', () => {
    const history = toGeminiHistory([
      { text: 'first', isUser: true },
      { text: 'second', isUser: true },
      { text: 'reply', isUser: false },
    ]);
    expect(history).toHaveLength(2);
    expect(history[0].parts[0].text).toBe('first\n\nsecond');
  });

  it('strictly alternates roles', () => {
    const history = toGeminiHistory([
      { text: 'a', isUser: true },
      { text: 'b', isUser: false },
      { text: 'c', isUser: false },
      { text: 'd', isUser: true },
    ]);
    history.forEach((turn, i) => {
      expect(turn.role).toBe(i % 2 === 0 ? 'user' : 'model');
    });
  });

  it('skips blank messages and tolerates junk', () => {
    expect(toGeminiHistory([{ text: '   ', isUser: true }])).toEqual([]);
    expect(toGeminiHistory([{ isUser: true }])).toEqual([]);
    expect(toGeminiHistory([])).toEqual([]);
    expect(toGeminiHistory(undefined)).toEqual([]);
  });

  it('caps history length', () => {
    const many = Array.from({ length: 40 }, (_, i) => ({
      text: `m${i}`,
      isUser: i % 2 === 0,
    }));
    expect(toGeminiHistory(many).length).toBeLessThanOrEqual(12);
  });
});

describe('generateChatReply without a Gemini key', () => {
  it('degrades to the offline engine instead of failing', async () => {
    const result = await generateChatReply({ message: 'hi', mood: 'Calm', history: [] });
    expect(result.source).toBe('offline');
    expect(typeof result.text).toBe('string');
    expect(result.text.length).toBeGreaterThan(0);
  });
});
