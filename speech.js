import React, { useState, useEffect, useRef } from 'react';
import { Platform } from 'react-native';

let Voice;
if (Platform.OS !== 'web') {
  try {
    Voice = require('@react-native-voice/voice').default;
  } catch (e) {
    console.warn('Voice native module not available. Fallback to web implementation.');
  }
}

export const useSpeechToText = ({ onResults, onEnd, onError }) => {
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const rec = new SpeechRecognition();
        rec.continuous = false;
        rec.interimResults = false;
        rec.lang = 'en-US';

        rec.onstart = () => {
          setIsListening(true);
        };
        
        rec.onresult = (event) => {
          if (event.results && event.results[0] && event.results[0][0]) {
            const text = event.results[0][0].transcript;
            if (onResults) onResults(text);
          }
        };

        rec.onerror = (event) => {
          setIsListening(false);
          if (onError) onError(event.error);
        };

        rec.onend = () => {
          setIsListening(false);
          if (onEnd) onEnd();
        };

        recognitionRef.current = rec;
      }
    } else if (Voice) {
      Voice.onSpeechStart = () => {
        setIsListening(true);
      };
      
      Voice.onSpeechEnd = () => {
        setIsListening(false);
        if (onEnd) onEnd();
      };

      Voice.onSpeechError = (e) => {
        setIsListening(false);
        if (onError) onError(e.error || e.message);
      };

      Voice.onSpeechResults = (e) => {
        if (e.value && e.value[0]) {
          if (onResults) onResults(e.value[0]);
        }
      };
    }

    return () => {
      if (Platform.OS !== 'web' && Voice) {
        Voice.destroy().then(Voice.removeAllListeners).catch(e => console.warn(e));
      }
    };
  }, [onResults, onEnd, onError]);

  const startListening = async () => {
    if (Platform.OS === 'web') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (e) {
          console.error('Web speech start error:', e);
        }
      } else {
        console.warn('Speech recognition not supported in this browser.');
      }
    } else if (Voice) {
      try {
        await Voice.start('en-US');
      } catch (e) {
        console.error('Native speech start error:', e);
        if (onError) onError(e);
      }
    } else {
      console.warn('Speech recognition is not supported on this platform.');
    }
  };

  const stopListening = async () => {
    if (Platform.OS === 'web') {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {
          console.error('Web speech stop error:', e);
        }
      }
    } else if (Voice) {
      try {
        await Voice.stop();
      } catch (e) {
        console.error('Native speech stop error:', e);
      }
    }
  };

  const isSupported = Platform.OS === 'web' 
    ? !!(window.SpeechRecognition || window.webkitSpeechRecognition)
    : !!Voice;

  return {
    isListening,
    startListening,
    stopListening,
    isSupported
  };
};
