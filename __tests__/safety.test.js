import { detectCrisis } from '../lib/safety';

describe('detectCrisis', () => {
  it('fires on direct disclosures of self-harm or suicidal intent', () => {
    const disclosures = [
      'i want to die',
      "I don't want to live anymore",
      'I have been thinking about killing myself',
      'sometimes I wish I were dead',
      'i keep hurting myself when it gets bad',
      'everyone would be better off without me',
      'I feel suicidal today',
      'I have been cutting myself again',
      'there is no point in living',
    ];
    disclosures.forEach((text) => {
      expect([text, detectCrisis(text)]).toEqual([text, true]);
    });
  });

  it('does not fire on ordinary distress that is not crisis language', () => {
    const ordinary = [
      'I feel like this is too much for me right now',
      'work has been really stressful this week',
      'I am so tired of everything going wrong',
      'this deadline is killing me',
      'I could die of embarrassment',
      'my phone died again',
      'I want to dye my hair',
    ];
    ordinary.forEach((text) => {
      expect([text, detectCrisis(text)]).toEqual([text, false]);
    });
  });

  it('stands down when the topic is discussed rather than disclosed', () => {
    expect(detectCrisis('I watched a documentary about suicide last night')).toBe(false);
    expect(detectCrisis('my friend said he wanted to die and I am worried')).toBe(false);
    expect(detectCrisis('I used to self harm when I was a teen')).toBe(false);
  });

  it('handles empty and malformed input without throwing', () => {
    expect(detectCrisis('')).toBe(false);
    expect(detectCrisis('   ')).toBe(false);
    expect(detectCrisis(null)).toBe(false);
    expect(detectCrisis(undefined)).toBe(false);
  });
});
