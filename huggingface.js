import { HfInference } from '@huggingface/inference';

// API key is hardcoded here for on-device inference simulation
export const hf = new HfInference("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");

/**
 * Queries the Hugging Face inference API for a supportive wellness response.
 * Fallbacks are managed by the caller if this returns null.
 * 
 * @param {string} userMessage The user's input message
 * @param {string} currentMood The current mood selected by the user
 * @returns {Promise<string|null>} The AI response string, or null if query failed
 */
export const queryHuggingFace = async (userMessage, currentMood) => {
  try {
    const prompt = `You are Sattva AI, a highly empathetic and supportive mental wellness companion. 
The user is currently feeling: ${currentMood || 'Neutral'}.
User: "${userMessage}"
Provide a comforting, empathetic, and actionable response of 2-3 sentences. Encourage the user and keep a warm, positive, yet non-toxic tone.`;

    const response = await hf.chatCompletion({
      model: "meta-llama/Meta-Llama-3-8B-Instruct",
      messages: [
        { 
          role: "system", 
          content: "You are Sattva AI, a caring and compassionate mental health assistant. Keep responses under 100 words, highly empathetic, and constructive." 
        },
        { 
          role: "user", 
          content: prompt 
        }
      ],
      max_tokens: 150,
      temperature: 0.7
    });

    if (response && response.choices && response.choices[0] && response.choices[0].message) {
      const text = response.choices[0].message.content;
      if (text) return text.trim();
    }
  } catch (err) {
    console.warn("Hugging Face API request failed (likely offline/network error):", err.message);
  }
  return null;
};