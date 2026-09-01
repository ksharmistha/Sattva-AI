#!/usr/bin/env node
/**
 * Verifies the Gemini setup without launching the app.
 *
 *   npm run check:ai
 *
 * Reads EXPO_PUBLIC_GEMINI_API_KEY / EXPO_PUBLIC_GEMINI_MODEL from .env,
 * lists the models your key can actually use, and sends one real prompt.
 */
import fs from 'node:fs';
import path from 'node:path';

const ENV_PATH = path.resolve(process.cwd(), '.env');

const loadEnv = () => {
  if (!fs.existsSync(ENV_PATH)) return {};
  return fs
    .readFileSync(ENV_PATH, 'utf8')
    .split('\n')
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const idx = trimmed.indexOf('=');
      if (idx === -1) return acc;
      acc[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
      return acc;
    }, {});
};

const env = { ...loadEnv(), ...process.env };
const apiKey = env.EXPO_PUBLIC_GEMINI_API_KEY;
const model = env.EXPO_PUBLIC_GEMINI_MODEL || 'gemini-2.0-flash';

if (!apiKey) {
  console.error('✖ EXPO_PUBLIC_GEMINI_API_KEY is not set.');
  console.error('  1. Get a free key at https://aistudio.google.com/app/apikey');
  console.error('  2. Add it to .env');
  console.error('\n  The app still runs without it, using the offline reply engine.');
  process.exit(1);
}

console.log(`→ Key found (…${apiKey.slice(-6)})`);
console.log(`→ Configured model: ${model}\n`);

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

const listModels = async () => {
  const res = await fetch(`${BASE}/models?key=${apiKey}`);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Could not list models (HTTP ${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return (data.models || [])
    .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
    .map((m) => m.name.replace(/^models\//, ''));
};

const generate = async (name) => {
  const res = await fetch(`${BASE}/models/${name}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: Sattva AI is connected.' }] }],
      generationConfig: { maxOutputTokens: 40 },
    }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${body.slice(0, 300)}`);
  const data = JSON.parse(body);
  return data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '(empty response)';
};

try {
  const available = await listModels();
  console.log(`✓ Key is valid. ${available.length} models available for generateContent.`);

  if (!available.includes(model)) {
    console.warn(`\n⚠ "${model}" is not in your available models.`);
    const suggestions = available.filter((m) => m.includes('flash')).slice(0, 5);
    if (suggestions.length) {
      console.warn(`  Try one of these in .env as EXPO_PUBLIC_GEMINI_MODEL:`);
      suggestions.forEach((m) => console.warn(`    ${m}`));
    }
    process.exit(1);
  }

  console.log(`\n→ Sending a test prompt to ${model}…`);
  const reply = await generate(model);
  console.log(`✓ Model replied: "${reply}"`);
  console.log('\n✓ Gemini is correctly configured. Chat replies will be live.');
} catch (err) {
  console.error(`\n✖ ${err.message}`);
  console.error('\n  The app will still run and fall back to the offline reply engine.');
  process.exit(1);
}
