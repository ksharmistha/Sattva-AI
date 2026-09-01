/**
 * Contract tests against the REAL @google/generative-ai SDK (no mocks, no
 * network). The other Gemini tests mock the SDK, so they would keep passing
 * even if our usage drifted from the library's actual API. These assert that
 * the enums, parameter shapes and call chain we rely on genuinely exist.
 *
 * Nothing here performs a request: getGenerativeModel() and startChat() are
 * local constructions. Only sendMessage() would go to the network.
 */
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { toGeminiHistory } from '../lib/ai';
import { SATTVA_SYSTEM_PROMPT, WELLNESS_INSIGHT_PROMPT } from '../lib/prompts';

describe('Gemini SDK contract', () => {
  it('exposes every harm category and threshold lib/ai.js configures', () => {
    ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH',
     'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
      .forEach((key) => expect(HarmCategory[key]).toBeDefined());

    expect(HarmBlockThreshold.BLOCK_ONLY_HIGH).toBeDefined();
  });

  it('accepts the exact model params lib/ai.js sends', () => {
    const genAI = new GoogleGenerativeAI('test-key-not-used');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: SATTVA_SYSTEM_PROMPT,
      safetySettings: [
        HarmCategory.HARM_CATEGORY_HARASSMENT,
        HarmCategory.HARM_CATEGORY_HATE_SPEECH,
        HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
        HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      ].map((category) => ({ category, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH })),
      generationConfig: { temperature: 0.85, topP: 0.95, maxOutputTokens: 220 },
    });

    expect(typeof model.startChat).toBe('function');
    expect(typeof model.generateContent).toBe('function');
    expect(model.model).toContain('gemini-2.0-flash');
  });

  it('accepts our normalised history shape in startChat', () => {
    const genAI = new GoogleGenerativeAI('test-key-not-used');
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const history = toGeminiHistory([
      { text: 'Welcome to Sattva AI', isUser: false },
      { text: 'I had a rough day', isUser: true },
      { text: 'That sounds heavy.', isUser: false },
    ]);

    const chat = model.startChat({ history });
    expect(typeof chat.sendMessage).toBe('function');
    // getHistory is async in the SDK and reflects what we handed over.
    return chat.getHistory().then((stored) => {
      expect(stored).toEqual(history);
      stored.forEach((turn) => {
        expect(['user', 'model']).toContain(turn.role);
        expect(Array.isArray(turn.parts)).toBe(true);
        expect(typeof turn.parts[0].text).toBe('string');
      });
    });
  });

  it('accepts the insight prompt as a system instruction with empty history', () => {
    const genAI = new GoogleGenerativeAI('test-key-not-used');
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: WELLNESS_INSIGHT_PROMPT,
    });
    expect(typeof model.startChat({ history: [] }).sendMessage).toBe('function');
  });
});

describe('system prompt safety guarantees', () => {
  it('forbids clinical roles and diagnosis', () => {
    expect(SATTVA_SYSTEM_PROMPT).toMatch(/NOT a therapist|not a therapist/i);
    expect(SATTVA_SYSTEM_PROMPT).toMatch(/never diagnose/i);
    expect(SATTVA_SYSTEM_PROMPT).toMatch(/medication/i);
  });

  it('asks for concise, chat-shaped replies', () => {
    expect(SATTVA_SYSTEM_PROMPT).toMatch(/2-4 short sentences/i);
    expect(SATTVA_SYSTEM_PROMPT).toMatch(/no markdown/i);
  });

  it('keeps the insight prompt free of clinical language and invention', () => {
    expect(WELLNESS_INSIGHT_PROMPT).toMatch(/never diagnose|Never diagnose/i);
    expect(WELLNESS_INSIGHT_PROMPT).toMatch(/Do not invent statistics/i);
  });
});
