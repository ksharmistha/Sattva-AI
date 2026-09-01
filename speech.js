// speech.js
//
// Cross-platform speech-to-text.
//   * web    - the browser SpeechRecognition API (Chromium only).
//   * native - @react-native-voice/voice, which needs a development build;
//              it is not available in Expo Go.
//
// Lifecycle note: the previous version listed the caller's callbacks in the
// effect's dependency array. Callers pass inline arrows, so those identities
// changed on every render and the recogniser was destroyed and rebuilt
// constantly. Callbacks are now held in refs and the setup effect runs once.

import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';

let Voice = null;
if (Platform.OS !== 'web') {
  try {
    Voice = require('@react-native-voice/voice').default;
  } catch {
    // Expected in Expo Go, where the native module is not linked.
    console.warn('[Sattva AI] Native voice module unavailable; voice input disabled.');
  }
}

const getWebSpeechRecognition = () => {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  return window.SpeechRecognition || window.webkitSpeechRecognition || null;
};

export const useSpeechToText = ({ onResults, onEnd, onError } = {}) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  // Callbacks live in refs so re-renders never re-initialise the recogniser.
  const handlersRef = useRef({ onResults, onEnd, onError });
  useEffect(() => {
    handlersRef.current = { onResults, onEnd, onError };
  }, [onResults, onEnd, onError]);

  const emit = useCallback((name, ...args) => {
    const fn = handlersRef.current?.[name];
    if (typeof fn === 'function') fn(...args);
  }, []);

  // Set up once per platform. Empty dep array is intentional - see above.
  useEffect(() => {
    let disposed = false;

    if (Platform.OS === 'web') {
      const SpeechRecognition = getWebSpeechRecognition();
      if (!SpeechRecognition) return undefined;

      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';

      rec.onstart = () => {
        if (!disposed) setIsListening(true);
      };
      rec.onresult = (event) => {
        const text = event?.results?.[0]?.[0]?.transcript;
        if (text) emit('onResults', text);
      };
      rec.onerror = (event) => {
        if (!disposed) setIsListening(false);
        // 'aborted' and 'no-speech' fire during normal use; they are not
        // worth interrupting the user for.
        if (event?.error && event.error !== 'aborted' && event.error !== 'no-speech') {
          emit('onError', event.error);
        }
      };
      rec.onend = () => {
        if (!disposed) setIsListening(false);
        emit('onEnd');
      };

      recognitionRef.current = rec;

      return () => {
        disposed = true;
        try {
          rec.onstart = null;
          rec.onresult = null;
          rec.onerror = null;
          rec.onend = null;
          rec.abort();
        } catch {
          // Aborting a recogniser that never started throws; harmless.
        }
        recognitionRef.current = null;
      };
    }

    if (!Voice) return undefined;

    Voice.onSpeechStart = () => {
      if (!disposed) setIsListening(true);
    };
    Voice.onSpeechEnd = () => {
      if (!disposed) setIsListening(false);
      emit('onEnd');
    };
    Voice.onSpeechError = (e) => {
      if (!disposed) setIsListening(false);
      emit('onError', e?.error?.message || e?.error || 'Speech recognition failed');
    };
    Voice.onSpeechResults = (e) => {
      const text = e?.value?.[0];
      if (text) emit('onResults', text);
    };

    return () => {
      disposed = true;
      Voice.destroy()
        .then(Voice.removeAllListeners)
        .catch(() => {
          // Nothing to tear down; safe to ignore.
        });
    };
  }, [emit]);

  const startListening = useCallback(async () => {
    if (Platform.OS === 'web') {
      const rec = recognitionRef.current;
      if (!rec) return;
      try {
        rec.start();
      } catch (e) {
        // start() throws if already running - treat as a no-op.
        if (!/already started/i.test(e?.message || '')) {
          emit('onError', e?.message || 'Could not start voice input');
        }
      }
      return;
    }

    if (!Voice) return;
    try {
      await Voice.start('en-US');
    } catch (e) {
      setIsListening(false);
      emit('onError', e?.message || 'Could not start voice input');
    }
  }, [emit]);

  const stopListening = useCallback(async () => {
    if (Platform.OS === 'web') {
      try {
        recognitionRef.current?.stop();
      } catch {
        // Already stopped.
      }
      return;
    }

    if (!Voice) return;
    try {
      await Voice.stop();
    } catch (e) {
      console.warn('Native speech stop error:', e);
    } finally {
      setIsListening(false);
    }
  }, []);

  const isSupported = Platform.OS === 'web' ? !!getWebSpeechRecognition() : !!Voice;

  return { isListening, startListening, stopListening, isSupported };
};
