/**
 * Verifies the Gemini integration wiring against a mocked SDK: that the
 * system prompt, sanitised history and user message are handed over
 * correctly, and that failures degrade to the offline engine.
 *
 * Live connectivity is checked separately with `npm run check:ai`.
 */

const mockSendMessage = jest.fn();
const mockStartChat = jest.fn(() => ({ sendMessage: mockSendMessage }));
const mockGetGenerativeModel = jest.fn(() => ({ startChat: mockStartChat }));

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn(() => ({ getGenerativeModel: mockGetGenerativeModel })),
  HarmCategory: {
    HARM_CATEGORY_HARASSMENT: 'HARM_CATEGORY_HARASSMENT',
    HARM_CATEGORY_HATE_SPEECH: 'HARM_CATEGORY_HATE_SPEECH',
    HARM_CATEGORY_SEXUALLY_EXPLICIT: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
    HARM_CATEGORY_DANGEROUS_CONTENT: 'HARM_CATEGORY_DANGEROUS_CONTENT',
  },
  HarmBlockThreshold: { BLOCK_ONLY_HIGH: 'BLOCK_ONLY_HIGH' },
}));

// lib/env reads process.env at import time, so the key is set before require.
jest.mock('../lib/env', () => ({
  geminiConfig: { apiKey: 'test-key', model: 'gemini-2.0-flash' },
  isGeminiConfigured: () => true,
  firebaseConfig: {},
  isFirebaseConfigured: () => true,
  missingFirebaseKeys: () => [],
}));

const loadAi = () => {
  let mod;
  jest.isolateModules(() => {
    mod = require('../lib/ai');
  });
  return mod;
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('generateChatReply with Gemini available', () => {
  it('returns the model reply and tags it as gemini', async () => {
    mockSendMessage.mockResolvedValue({ response: { text: () => '  You are not alone in this.  ' } });
    const { generateChatReply } = loadAi();

    const result = await generateChatReply({
      message: 'I had a hard day',
      mood: 'Sad',
      history: [],
    });

    expect(result).toEqual({ text: 'You are not alone in this.', source: 'gemini' });
    expect(mockSendMessage).toHaveBeenCalledWith('I had a hard day');
  });

  it('sends the Sattva system prompt and folds in the current mood', async () => {
    mockSendMessage.mockResolvedValue({ response: { text: () => 'ok' } });
    const { generateChatReply } = loadAi();

    await generateChatReply({ message: 'hi', mood: 'Stressed', history: [] });

    const config = mockGetGenerativeModel.mock.calls[0][0];
    expect(config.model).toBe('gemini-2.0-flash');
    expect(config.systemInstruction).toMatch(/You are Sattva AI/);
    expect(config.systemInstruction).toMatch(/never diagnose|Never diagnose/);
    expect(config.systemInstruction).toMatch(/"Stressed"/);
    expect(config.safetySettings).toHaveLength(4);
  });

  it('passes sanitised conversation history to startChat', async () => {
    mockSendMessage.mockResolvedValue({ response: { text: () => 'ok' } });
    const { generateChatReply } = loadAi();

    await generateChatReply({
      message: 'and today?',
      mood: null,
      history: [
        { text: 'Welcome to Sattva AI', isUser: false },
        { text: 'I felt low yesterday', isUser: true },
        { text: 'That sounds heavy.', isUser: false },
      ],
    });

    const { history } = mockStartChat.mock.calls[0][0];
    expect(history).toEqual([
      { role: 'user', parts: [{ text: 'I felt low yesterday' }] },
      { role: 'model', parts: [{ text: 'That sounds heavy.' }] },
    ]);
  });

  it('falls back to the offline engine when the API call fails', async () => {
    mockSendMessage.mockRejectedValue(new Error('429 quota exceeded'));
    const { generateChatReply } = loadAi();

    const result = await generateChatReply({ message: 'hello', mood: 'Calm', history: [] });

    expect(result.source).toBe('offline');
    expect(result.text.length).toBeGreaterThan(0);
  });

  it('falls back when the model returns an empty response', async () => {
    mockSendMessage.mockResolvedValue({ response: { text: () => '   ' } });
    const { generateChatReply } = loadAi();

    const result = await generateChatReply({ message: 'hello', mood: null, history: [] });
    expect(result.source).toBe('offline');
  });
});

describe('generateWellnessInsight', () => {
  it('sends only aggregate stats, never raw user content', async () => {
    mockSendMessage.mockResolvedValue({ response: { text: () => 'A steady week overall.' } });
    const { generateWellnessInsight } = loadAi();

    const result = await generateWellnessInsight(
      {
        averageMood: '3.4',
        trend: '+8%',
        primaryMood: 'Calm',
        daysLogged: 5,
        hardestDay: 'Monday',
      },
      'local fallback text'
    );

    expect(result).toEqual({ text: 'A steady week overall.', source: 'gemini' });

    const sent = mockSendMessage.mock.calls[0][0];
    expect(sent).toContain('Average mood index: 3.4/5');
    expect(sent).toContain('Lowest-scoring weekday: Monday');
    // No chat history is ever attached to an insight request.
    expect(mockStartChat.mock.calls[0][0].history).toEqual([]);
  });

  it('returns the caller-supplied local report when the API fails', async () => {
    mockSendMessage.mockRejectedValue(new Error('network down'));
    const { generateWellnessInsight } = loadAi();

    const result = await generateWellnessInsight(
      { averageMood: '3.0', trend: '0%', primaryMood: 'Neutral', daysLogged: 2, hardestDay: null },
      'local fallback text'
    );

    expect(result).toEqual({ text: 'local fallback text', source: 'offline' });
  });
});
