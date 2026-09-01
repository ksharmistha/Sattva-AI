import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Image, ScrollView, ActivityIndicator, Alert, Animated, Platform, Linking, KeyboardAvoidingView, useWindowDimensions } from 'react-native';
import React, { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import ErrorBoundary from 'react-native-error-boundary';
import CalendarScreen from './CalendarScreen';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc, addDoc, setDoc } from 'firebase/firestore';
import { db, firebaseReady } from './firebase';
import { Ionicons } from '@expo/vector-icons';
import ExercisesScreen from './ExercisesScreen';
import StatsScreen from './StatsScreen';

// Auth Imports
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import AuthScreen from './AuthScreen';

// Speech & AI Imports
import { useSpeechToText } from './speech';
import { generateChatReply, isGeminiConfigured } from './lib/ai';
import {
  detectCrisis,
  CRISIS_RESOURCES,
  CRISIS_REPLY,
  NOT_AN_EMERGENCY_SERVICE,
} from './lib/safety';
import { missingFirebaseKeys } from './lib/env';

const Stack = createStackNavigator();
const ACCENT_COLOR = '#9DC08B';

const SUGGESTIONS = [
  { emoji: '🌬️', text: 'Guided breathing exercise' },
  { emoji: '🧘', text: 'Start mindful meditation' },
  { emoji: '📋', text: 'Grounding exercise' },
  { emoji: '😢', text: 'I am feeling overwhelmed' },
  { emoji: '📊', text: 'Tell me about my mood trends' },
  { emoji: '🌸', text: 'How do I track my cycle?' }
];

// Simple MoodButton component
const MoodButton = ({ emoji, label, onPress, isSelected }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 0.8,
          useNativeDriver: true,
          friction: 5,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 3,
        }),
        Animated.timing(rotateAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]),
    ]).start();

    onPress();
  };

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '20deg'],
  });

  return (
    <TouchableOpacity onPress={handlePress} style={styles.moodButtonWrapper}>
      <Animated.View 
        style={[
          styles.moodButton,
          isSelected && styles.moodButtonSelected,
          {
            transform: [
              { scale: scaleAnim },
              { rotate: spin },
            ],
          },
        ]}
      >
        <Text style={styles.moodEmoji}>{emoji}</Text>
        <Text style={styles.moodLabel}>{label}</Text>
      </Animated.View>
    </TouchableOpacity>
  );
};

// Pulsing Waveform for Microphone Active State
const VoiceVisualizer = () => {
  const animations = useRef([
    new Animated.Value(15),
    new Animated.Value(30),
    new Animated.Value(10),
    new Animated.Value(45),
    new Animated.Value(20),
    new Animated.Value(35),
    new Animated.Value(15),
  ]).current;

  useEffect(() => {
    const loops = animations.map((anim, idx) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: Math.random() * 45 + 15,
            duration: 150 + idx * 40,
            useNativeDriver: false,
          }),
          Animated.timing(anim, {
            toValue: Math.random() * 15 + 5,
            duration: 150 + idx * 40,
            useNativeDriver: false,
          })
        ])
      );
    });

    Animated.parallel(loops).start();

    return () => {
      loops.forEach(l => l.stop());
    };
  }, []);

  return (
    <View style={styles.voiceVisualizerContainer}>
      <Text style={styles.voiceListeningText}>Listening to your voice...</Text>
      <View style={styles.voiceWaves}>
        {animations.map((anim, idx) => (
          <Animated.View 
            key={idx} 
            style={[
              styles.voiceWaveBar, 
              { height: anim }
            ]} 
          />
        ))}
      </View>
    </View>
  );
};

// Safety Escalation Modal Component
// Content is driven by lib/safety.js so the resource list and the
// "not an emergency service" wording live in one place.
const SafetyModal = ({ visible, onClose }) => {
  if (!visible) return null;

  const openResource = async (url) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert('Unavailable here', `This device cannot open ${url}. Please dial or visit it manually.`);
        return;
      }
      await Linking.openURL(url);
    } catch (err) {
      Alert.alert('Unavailable here', `Could not open ${url}. Please dial or visit it manually.`);
    }
  };

  return (
    <View style={styles.safetyOverlay}>
      <ScrollView
        contentContainerStyle={styles.safetyScroll}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.safetyCard}>
          <Ionicons name="heart-circle-outline" size={48} color="#E88383" style={{ marginBottom: 15 }} />
          <Text style={styles.safetyTitle}>We Care About You</Text>
          <Text style={styles.safetyDescription}>
            It sounds like you might be going through something really difficult. You do not have
            to face it on your own, and support is available right now.
          </Text>

          {CRISIS_RESOURCES.map((resource, idx) => (
            <TouchableOpacity
              key={resource.id}
              style={[
                styles.safetyButton,
                { backgroundColor: resource.primary ? '#E88383' : '#333' },
                idx > 0 && { marginTop: 10 },
              ]}
              onPress={() => openResource(resource.url)}
              accessibilityRole="button"
              accessibilityLabel={resource.label}
            >
              <Ionicons name={resource.icon} size={20} color="#fff" />
              <Text style={styles.safetyButtonText}>{resource.label}</Text>
            </TouchableOpacity>
          ))}

          <Text style={styles.safetyDisclaimer}>{NOT_AN_EMERGENCY_SERVICE}</Text>

          <TouchableOpacity style={styles.safetyCloseButton} onPress={onClose}>
            <Text style={styles.safetyCloseText}>Back to App</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

// HomeScreen component
function HomeScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  const { width } = useWindowDimensions();
  const isWide = width > 700;
  const [mood, setMood] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState(null);
  const [showSafetyModal, setShowSafetyModal] = useState(false);
  const [voiceNotice, setVoiceNotice] = useState(null);
  
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Speech Recognition hook.
  // The callbacks are memoised: passing fresh inline arrows caused the hook's
  // effect to tear down and rebuild the recogniser on every render.
  const handleSpeechResults = useCallback((text) => {
    setMessage(text);
  }, []);

  const handleSpeechError = useCallback((err) => {
    console.warn('Speech recognition error:', err);
    setVoiceNotice('Voice input stopped. You can type your message instead.');
  }, []);

  const { isListening, startListening, stopListening, isSupported } = useSpeechToText({
    onResults: handleSpeechResults,
    onError: handleSpeechError,
  });

  // Add animation effect
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Persists one chat turn and returns the Firestore id (or null if the write
  // failed - a failed write must not block the conversation).
  const persistMessage = async (text, isUser, timestamp) => {
    try {
      const ref = await addDoc(collection(db, 'messages'), {
        userId: auth.currentUser.uid,
        text,
        isUser,
        timestamp,
        reactions: [],
      });
      return ref.id;
    } catch (err) {
      console.error('Failed to persist message:', err);
      return null;
    }
  };

  const handleSendDirectMessage = async (msgText) => {
    const trimmedMessage = msgText.trim();
    if (!trimmedMessage || isMessageLoading) return;
    if (!auth?.currentUser) return;

    const userMessageId = `local-${Date.now()}`;
    const userTimestamp = new Date().toISOString();

    const userMessage = {
      id: userMessageId,
      text: trimmedMessage,
      isUser: true,
      timestamp: userTimestamp,
      reactions: [],
    };

    // Snapshot the transcript before this turn so it can be used as AI context.
    const priorHistory = messages;

    setMessage('');
    setMessages((prev) => [...prev, userMessage]);
    setIsMessageLoading(true);

    try {
      const userDocId = await persistMessage(trimmedMessage, true, userTimestamp);
      if (userDocId) {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMessageId ? { ...m, id: userDocId } : m))
        );
      }

      // SAFETY LAYER - runs before the model sees anything. On a crisis signal
      // we surface resources and reply with a fixed, reviewed message rather
      // than letting a language model improvise in a high-stakes moment.
      const isCrisis = detectCrisis(trimmedMessage);

      let aiResponseText;
      let replySource;

      if (isCrisis) {
        setShowSafetyModal(true);
        aiResponseText = CRISIS_REPLY;
        replySource = 'safety';
      } else {
        const reply = await generateChatReply({
          message: trimmedMessage,
          mood,
          history: priorHistory,
        });
        aiResponseText = reply.text;
        replySource = reply.source;
      }

      const aiTimestamp = new Date().toISOString();
      const aiDocId = await persistMessage(aiResponseText, false, aiTimestamp);

      setMessages((prev) => [
        ...prev,
        {
          id: aiDocId || `local-${Date.now()}-ai`,
          text: aiResponseText,
          isUser: false,
          timestamp: aiTimestamp,
          reactions: [],
          source: replySource,
        },
      ]);
    } catch (err) {
      console.error('Message Error:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: `local-${Date.now()}-err`,
          text: "I couldn't reach my services just then. Please check your connection and try again — your message was saved.",
          isUser: false,
          timestamp: new Date().toISOString(),
          reactions: [],
          source: 'error',
        },
      ]);
    } finally {
      setIsMessageLoading(false);
    }
  };

  const handleSendMessage = () => {
    handleSendDirectMessage(message);
  };

  const handleReaction = async (messageId, reaction) => {
    // Messages that failed to persist only exist locally, so there is no
    // document to update.
    if (String(messageId).startsWith('local-')) return;

    try {
      const messageRef = doc(db, 'messages', messageId);
      const messageDoc = await getDoc(messageRef);
      
      if (messageDoc.exists()) {
        const currentReactions = messageDoc.data().reactions || [];
        const newReactions = currentReactions.includes(reaction)
          ? currentReactions.filter(r => r !== reaction)
          : [...currentReactions, reaction];

        await updateDoc(messageRef, { reactions: newReactions });
        
        setMessages(prev => prev.map(msg => 
          msg.id === messageId 
            ? { ...msg, reactions: newReactions }
            : msg
        ));
      }
    } catch (err) {
      console.error('Reaction Error:', err);
    }
  };

  // Load the recent transcript once the user is available.
  // This query needs a composite index on (userId ASC, timestamp DESC) -
  // see firestore.indexes.json.
  useEffect(() => {
    let cancelled = false;

    const loadMessages = async () => {
      if (!auth?.currentUser) {
        setIsHistoryLoading(false);
        return;
      }

      try {
        const q = query(
          collection(db, 'messages'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const querySnapshot = await getDocs(q);
        if (cancelled) return;

        const fetchedMessages = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data(),
        }));
        setMessages(fetchedMessages.reverse());
        setHistoryError(null);
      } catch (err) {
        console.error('Error loading messages:', err);
        if (cancelled) return;
        // failed-precondition means the composite index is missing, which is
        // the single most common first-run problem. Say so plainly.
        setHistoryError(
          err?.code === 'failed-precondition'
            ? 'Chat history needs a Firestore index. Run "firebase deploy --only firestore:indexes" (see README).'
            : 'Could not load your earlier messages. You can still chat below.'
        );
      } finally {
        if (!cancelled) setIsHistoryLoading(false);
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, []);

  // Customize header with Logout and other navigation options
  useLayoutEffect(() => {
    navigation.setOptions({
      headerLeft: () => (
        <TouchableOpacity 
          style={[styles.headerButton, { marginLeft: 15 }]}
          onPress={async () => {
            try {
              await signOut(auth);
            } catch (err) {
              Alert.alert('Logout Failed', err.message);
            }
          }}
        >
          <Ionicons name="log-out-outline" size={22} color="#fff" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Stats')}
          >
            <Ionicons name="stats-chart" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Exercises')}
          >
            <Ionicons name="leaf-outline" size={20} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Calendar')}
          >
            <Ionicons name="calendar-outline" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [navigation]);

  const getMoodSelectionResponse = (selectedMood) => {
    const responses = {
      Happy: [
        "I'm glad you're feeling happy! Would you like to share what's bringing you joy?",
        "It's wonderful to see you in good spirits! What's making you smile today?",
        "Your happiness brightens the day! Want to talk about what's going well?"
      ],
      Calm: [
        "It's great that you're feeling calm. How did you find this peaceful state?",
        "A calm mind is a powerful mind. What's helping you stay centered?",
        "Enjoying some tranquility? Would you like to share what's bringing you peace?"
      ],
      Neutral: [
        "You're feeling neutral - that's okay. Would you like to talk about your day?",
        "Sometimes a neutral state helps us think clearly. What's on your mind?",
        "Taking things as they come? Let me know if you'd like to explore your feelings further."
      ],
      Sad: [
        "I'm here for you during this difficult time. Would you like to talk about what's troubling you?",
        "It's okay to feel sad. I'm here to listen if you want to share what's on your mind.",
        "Thank you for sharing how you feel. Would you like to talk about what's making you sad?"
      ],
      Stressed: [
        "I notice you're feeling stressed. Let's slow down. Would you like to do a quick box breathing exercise?",
        "Stress can be overwhelming. Let's work through this together - what's on your mind?",
        "I'm here to help you manage this stress. Want to tell me what's causing the pressure?"
      ]
    };

    const moodResponses = responses[selectedMood];
    return moodResponses[Math.floor(Math.random() * moodResponses.length)];
  };

  const handleMoodSelection = async (selectedMood) => {
    setMood(selectedMood);
    if (!auth?.currentUser) return;

    // One mood document per user per day. setDoc overwrites, so re-selecting
    // a mood later the same day updates the entry rather than duplicating it.
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const moodDocRef = doc(db, 'moods', `${auth.currentUser.uid}_${todayStr}`);
      await setDoc(moodDocRef, {
        userId: auth.currentUser.uid,
        date: todayStr,
        mood: selectedMood,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Error saving mood selection:', err);
      Alert.alert('Could not save mood', 'Your mood was not saved. Please check your connection.');
    }

    const aiResponseText = getMoodSelectionResponse(selectedMood);
    const aiTimestamp = new Date().toISOString();
    const aiDocId = await persistMessage(aiResponseText, false, aiTimestamp);

    setMessages((prev) => [
      ...prev,
      {
        id: aiDocId || `local-${Date.now()}-mood`,
        text: aiResponseText,
        isUser: false,
        timestamp: aiTimestamp,
        reactions: [],
      },
    ]);
  };

  const handleVoicePress = () => {
    setVoiceNotice(null);

    if (!isSupported) {
      setVoiceNotice(
        Platform.OS === 'web'
          ? 'Voice input needs a Chromium-based browser (Chrome or Edge). You can type instead.'
          : 'Voice input needs a development build with microphone access. You can type instead.'
      );
      return;
    }

    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // On wide screens the chat is centred in a phone-width column instead of
  // stretching edge to edge, which looked broken in the web demo.
  const contentStyle = [styles.contentColumn, isWide && styles.contentColumnWide];

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <SafetyModal visible={showSafetyModal} onClose={() => setShowSafetyModal(false)} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={contentStyle}>
          <View style={styles.welcomeSection}>
            <Text style={styles.welcomeTitle}>Welcome to Sattva AI</Text>
            <Text style={styles.welcomeDescription}>
              Your personal AI companion for emotional well-being and mental health support.
            </Text>
            <View style={styles.divider} />
          </View>

          <View style={{ paddingHorizontal: 20 }}>
            <Text style={styles.title}>How are you feeling?</Text>
          </View>

          <View style={styles.moodContainer}>
            <MoodButton emoji="😊" label="Happy" onPress={() => handleMoodSelection('Happy')} isSelected={mood === 'Happy'} />
            <MoodButton emoji="😌" label="Calm" onPress={() => handleMoodSelection('Calm')} isSelected={mood === 'Calm'} />
            <MoodButton emoji="😐" label="Neutral" onPress={() => handleMoodSelection('Neutral')} isSelected={mood === 'Neutral'} />
            <MoodButton emoji="😔" label="Sad" onPress={() => handleMoodSelection('Sad')} isSelected={mood === 'Sad'} />
            <MoodButton emoji="😫" label="Stressed" onPress={() => handleMoodSelection('Stressed')} isSelected={mood === 'Stressed'} />
          </View>

          {/* Suggestion Chips */}
          <View style={styles.suggestionsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
              {SUGGESTIONS.map((item) => (
                <TouchableOpacity
                  key={item.text}
                  style={styles.suggestionChip}
                  onPress={() => handleSendDirectMessage(item.text)}
                  disabled={isMessageLoading}
                >
                  <Text style={styles.suggestionEmoji}>{item.emoji}</Text>
                  <Text style={styles.suggestionText}>{item.text}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          {isListening && <VoiceVisualizer />}

          {voiceNotice && (
            <View style={styles.noticeBar}>
              <Ionicons name="information-circle-outline" size={16} color="#E8C983" />
              <Text style={styles.noticeText}>{voiceNotice}</Text>
              <TouchableOpacity onPress={() => setVoiceNotice(null)} hitSlop={8}>
                <Ionicons name="close" size={16} color="#888" />
              </TouchableOpacity>
            </View>
          )}

          {historyError && (
            <View style={styles.noticeBar}>
              <Ionicons name="cloud-offline-outline" size={16} color="#E8C983" />
              <Text style={styles.noticeText}>{historyError}</Text>
            </View>
          )}

          <ScrollView
            ref={scrollViewRef}
            style={styles.chatScrollView}
            contentContainerStyle={styles.chatContentContainer}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
          >
            {isHistoryLoading ? (
              <View style={styles.chatPlaceholder}>
                <ActivityIndicator color={ACCENT_COLOR} />
                <Text style={styles.chatPlaceholderText}>Loading your conversation…</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.chatPlaceholder}>
                <Ionicons name="chatbubbles-outline" size={30} color="#333" />
                <Text style={styles.chatPlaceholderText}>
                  Pick a mood above, tap a suggestion, or just say what is on your mind.
                </Text>
              </View>
            ) : (
              messages.map((msg) => (
                <ChatMessage
                  key={msg.id}
                  message={msg}
                  isUser={msg.isUser}
                  onReact={handleReaction}
                />
              ))
            )}
            {isMessageLoading && <TypingIndicator />}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TouchableOpacity
              style={[styles.voiceButton, isListening && { backgroundColor: '#E88383', borderColor: '#E88383' }]}
              onPress={handleVoicePress}
              accessibilityRole="button"
              accessibilityLabel={isListening ? 'Stop voice input' : 'Start voice input'}
            >
              <Ionicons name={isListening ? 'mic' : 'mic-outline'} size={22} color="#fff" />
            </TouchableOpacity>

            <TextInput
              style={styles.chatInput}
              placeholder={isListening ? 'Listening…' : 'Type a message…'}
              placeholderTextColor="#666"
              value={message}
              onChangeText={setMessage}
              onSubmitEditing={handleSendMessage}
              // react-native-web does not reliably fire onSubmitEditing, so
              // Enter is handled explicitly for the browser demo.
              onKeyPress={(e) => {
                if (e?.nativeEvent?.key === 'Enter') {
                  e.preventDefault?.();
                  handleSendMessage();
                }
              }}
              returnKeyType="send"
              multiline={false}
              editable={!isMessageLoading}
            />

            <TouchableOpacity
              style={[styles.sendButton, (isMessageLoading || !message.trim()) && styles.sendButtonDisabled]}
              onPress={handleSendMessage}
              disabled={isMessageLoading || !message.trim()}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              {isMessageLoading ? (
                <ActivityIndicator size="small" color="#0d0d0d" />
              ) : (
                <Text style={styles.sendButtonText}>Send</Text>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.inputDisclaimer}>
            Sattva AI is a wellbeing companion, not a therapist or emergency service.
            {!isGeminiConfigured() && ' Running in offline mode — add a Gemini API key for live AI replies.'}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ChatMessage Component
const ChatMessage = ({ message, isUser, onReact }) => {
  const [showReactions, setShowReactions] = useState(false);
  const currentReactions = message.reactions || [];

  return (
    <View style={[
      styles.messageContainerWrapper,
      isUser ? { alignItems: 'flex-end' } : { alignItems: 'flex-start' }
    ]}>
      <TouchableOpacity 
        activeOpacity={0.9}
        onLongPress={() => setShowReactions(!showReactions)}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessage : styles.aiMessage
        ]}
      >
        <Text style={[styles.messageText, isUser && { color: '#111' }]}>{message.text}</Text>
        {message.source === 'offline' && (
          <Text style={styles.offlineTag}>offline reply</Text>
        )}
      </TouchableOpacity>

      {/* Inline Reactions display */}
      {currentReactions.length > 0 && (
        <View style={styles.reactionsDisplayRow}>
          {currentReactions.map((r, i) => (
            <Text key={i} style={styles.reactionBadge}>{r}</Text>
          ))}
        </View>
      )}

      {/* Reaction picker */}
      {showReactions && (
        <View style={[styles.reactionPicker, isUser ? { right: 10 } : { left: 10 }]}>
          {['❤️', '👍', '🙏', '😢', '💪'].map((emoji) => (
            <TouchableOpacity 
              key={emoji} 
              style={styles.reactionPickerItem}
              onPress={() => {
                onReact(message.id, emoji);
                setShowReactions(false);
              }}
            >
              <Text style={{ fontSize: 16 }}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

// Shown when .env is missing or incomplete, instead of letting Firebase throw
// opaque errors deep inside the auth flow.
const SetupScreen = () => (
  <View style={styles.setupContainer}>
    <Ionicons name="construct-outline" size={44} color={ACCENT_COLOR} />
    <Text style={styles.setupTitle}>Configuration needed</Text>
    <Text style={styles.setupBody}>
      Sattva AI could not start because its Firebase configuration is missing.
    </Text>
    <View style={styles.setupCard}>
      <Text style={styles.setupStep}>1. cp .env.example .env</Text>
      <Text style={styles.setupStep}>2. Fill in your Firebase web config</Text>
      <Text style={styles.setupStep}>3. Restart the dev server</Text>
    </View>
    <Text style={styles.setupHint}>Missing keys: {missingFirebaseKeys().join(', ') || 'unknown'}</Text>
  </View>
);

// Fallback for any uncaught render error, so a crash in one screen does not
// leave the user staring at a blank white page during a demo.
const CrashFallback = ({ error, resetError }) => (
  <View style={styles.setupContainer}>
    <Ionicons name="alert-circle-outline" size={44} color="#E88383" />
    <Text style={styles.setupTitle}>Something went wrong</Text>
    <Text style={styles.setupBody}>{error?.message || 'An unexpected error occurred.'}</Text>
    <TouchableOpacity style={styles.setupButton} onPress={resetError}>
      <Text style={styles.setupButtonText}>Try again</Text>
    </TouchableOpacity>
  </View>
);

// Main App component with Firebase Auth Conditional Navigation
function RootNavigator() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    if (!firebaseReady) {
      setAuthLoading(false);
      return undefined;
    }
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  if (!firebaseReady) return <SetupScreen />;

  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
        <Text style={styles.chatPlaceholderText}>Starting Sattva AI…</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <StatusBar style="light" />
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: '#111',
            borderBottomWidth: 1,
            borderBottomColor: '#222',
            elevation: 0,
            shadowOpacity: 0,
          },
          headerTintColor: '#fff',
          cardStyle: { backgroundColor: '#0d0d0d' },
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
                opacity: current.progress.interpolate({
                  inputRange: [0, 0.5, 1],
                  outputRange: [0, 0.5, 1],
                }),
              },
              overlayStyle: {
                opacity: current.progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 0.5],
                }),
              },
            };
          },
        }}
      >
        {!user ? (
          <Stack.Screen 
            name="Auth" 
            component={AuthScreen} 
            options={{ headerShown: false }} 
          />
        ) : (
          <>
            <Stack.Screen 
              name="Home" 
              component={HomeScreen}
              options={{
                headerTitle: () => (
                  <View style={styles.headerContainer}>
                    <View style={styles.headerContent}>
                      <View style={styles.headerLogoContainer}>
                        <Image
                          source={require('./assets/logo.png')}
                          style={styles.headerLogo}
                          resizeMode="contain"
                        />
                      </View>
                      <Text style={styles.headerAppName}>Sattva{'\n'}AI</Text>
                    </View>
                  </View>
                ),
              }}
            />
            <Stack.Screen 
              name="Calendar" 
              component={CalendarScreen} 
              options={{
                cardStyleInterpolator: ({ current, layouts }) => ({
                  cardStyle: {
                    transform: [
                      {
                        translateY: current.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [layouts.screen.height, 0],
                        }),
                      },
                    ],
                    opacity: current.progress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.5, 1],
                    }),
                  },
                }),
              }}
            />
            <Stack.Screen 
              name="Exercises" 
              component={ExercisesScreen}
              options={{
                cardStyleInterpolator: ({ current, layouts }) => ({
                  cardStyle: {
                    transform: [
                      {
                        translateX: current.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-layouts.screen.width, 0],
                        }),
                      },
                    ],
                    opacity: current.progress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.5, 1],
                    }),
                  },
                }),
              }}
            />
            <Stack.Screen 
              name="Stats" 
              component={StatsScreen}
              options={{
                cardStyleInterpolator: ({ current, layouts }) => ({
                  cardStyle: {
                    transform: [
                      {
                        translateY: current.progress.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-layouts.screen.height, 0],
                        }),
                      },
                    ],
                    opacity: current.progress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [0, 0.5, 1],
                    }),
                  },
                }),
              }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// GestureHandlerRootView is required by @react-navigation/stack for swipe
// gestures; SafeAreaProvider keeps content clear of notches and home bars.
export default function App() {
  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <ErrorBoundary FallbackComponent={CrashFallback}>
          <RootNavigator />
        </ErrorBoundary>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d',
  },
  // Keeps the chat readable on wide/desktop viewports instead of stretching
  // a phone layout across the whole screen.
  contentColumn: {
    flex: 1,
    width: '100%',
  },
  contentColumnWide: {
    maxWidth: 620,
    alignSelf: 'center',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#1a1a1a',
  },
  noticeBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 15,
    marginBottom: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(232, 201, 131, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(232, 201, 131, 0.2)',
  },
  noticeText: {
    flex: 1,
    color: '#d8c9a3',
    fontSize: 12,
    lineHeight: 17,
  },
  chatPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    paddingHorizontal: 30,
    gap: 10,
  },
  chatPlaceholderText: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
    marginTop: 8,
  },
  inputDisclaimer: {
    color: '#5a5a5a',
    fontSize: 10.5,
    lineHeight: 15,
    textAlign: 'center',
    paddingHorizontal: 20,
    paddingBottom: 10,
    backgroundColor: '#131313',
  },
  sendButtonDisabled: {
    opacity: 0.45,
  },
  offlineTag: {
    color: '#666',
    fontSize: 10,
    marginTop: 6,
    fontStyle: 'italic',
  },
  // Setup / crash screens
  setupContainer: {
    flex: 1,
    backgroundColor: '#0d0d0d',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    gap: 12,
  },
  setupTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  setupBody: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  setupCard: {
    backgroundColor: '#151515',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#222',
    padding: 16,
    gap: 8,
    marginTop: 8,
  },
  setupStep: {
    color: '#ccc',
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  setupHint: {
    color: '#666',
    fontSize: 12,
    marginTop: 4,
  },
  setupButton: {
    marginTop: 10,
    paddingVertical: 12,
    paddingHorizontal: 26,
    borderRadius: 14,
    backgroundColor: ACCENT_COLOR,
  },
  setupButtonText: {
    color: '#0d0d0d',
    fontSize: 14,
    fontWeight: 'bold',
  },
  safetyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 30,
  },
  safetyDisclaimer: {
    color: '#8a8a8a',
    fontSize: 11.5,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 16,
  },
  welcomeSection: {
    padding: 20,
    backgroundColor: '#131313',
    borderBottomWidth: 1,
    borderBottomColor: '#222',
  },
  chatScrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  chatContentContainer: {
    paddingTop: 10,
    paddingBottom: 25,
  },
  welcomeTitle: {
    color: ACCENT_COLOR,
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  welcomeDescription: {
    color: '#aaa',
    fontSize: 14,
    lineHeight: 20,
  },
  divider: {
    height: 1,
    backgroundColor: '#222',
    marginTop: 12,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginTop: 15,
    marginBottom: 10,
  },
  moodContainer: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    gap: 6,
    marginBottom: 15,
  },
  moodButtonWrapper: {
    flex: 1,
  },
  moodButton: {
    backgroundColor: '#151515',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 60,
    maxWidth: 78,
    borderWidth: 1,
    borderColor: '#222',
  },
  moodButtonSelected: {
    backgroundColor: '#222',
    borderColor: ACCENT_COLOR,
    borderWidth: 1.5,
  },
  moodEmoji: {
    fontSize: 24,
    marginBottom: 4,
  },
  moodLabel: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
  },
  suggestionsContainer: {
    paddingHorizontal: 15,
    marginBottom: 12,
  },
  suggestionsScroll: {
    gap: 8,
    paddingRight: 10,
  },
  suggestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#222',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    gap: 6,
  },
  suggestionEmoji: {
    fontSize: 15,
  },
  suggestionText: {
    color: '#bbb',
    fontSize: 12,
    fontWeight: '500',
  },
  voiceVisualizerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#131313',
    borderRadius: 16,
    marginHorizontal: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(157, 192, 139, 0.15)',
  },
  voiceListeningText: {
    color: ACCENT_COLOR,
    fontSize: 13,
    marginBottom: 8,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  voiceWaves: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    height: 50,
  },
  voiceWaveBar: {
    width: 5,
    borderRadius: 2.5,
    backgroundColor: ACCENT_COLOR,
    minHeight: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 12,
    backgroundColor: '#131313',
    borderTopWidth: 1,
    borderTopColor: '#222',
    alignItems: 'center',
    gap: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#1e1e1e',
    borderRadius: 22,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 15,
    color: '#fff',
    minHeight: 40,
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  sendButton: {
    paddingHorizontal: 18,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 14,
    color: '#0d0d0d',
    fontWeight: 'bold',
  },
  headerContainer: {
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogoContainer: {
    backgroundColor: '#151515',
    padding: 6,
    borderRadius: 10,
  },
  headerLogo: {
    width: 28,
    height: 28,
  },
  headerAppName: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 14,
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
    marginRight: 15,
  },
  headerButton: {
    padding: 8,
    borderRadius: 18,
    backgroundColor: '#151515',
    borderWidth: 1,
    borderColor: '#222',
  },
  typingContainer: {
    flexDirection: 'row',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: ACCENT_COLOR,
  },
  messageContainerWrapper: {
    width: '100%',
    marginVertical: 4,
    position: 'relative',
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 18,
  },
  userMessage: {
    backgroundColor: ACCENT_COLOR,
    alignSelf: 'flex-end',
    marginRight: 10,
    borderBottomRightRadius: 4,
  },
  aiMessage: {
    backgroundColor: '#151515',
    alignSelf: 'flex-start',
    marginLeft: 10,
    borderWidth: 1,
    borderColor: '#222',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 22,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e1e1e',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2d2d2d',
  },
  // Reactions
  reactionsDisplayRow: {
    flexDirection: 'row',
    marginTop: -8,
    marginBottom: 5,
    marginHorizontal: 15,
    gap: 3,
  },
  reactionBadge: {
    backgroundColor: '#222',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    fontSize: 11,
    overflow: 'hidden',
    borderWidth: 0.5,
    borderColor: '#333',
    color: '#fff',
  },
  reactionPicker: {
    position: 'absolute',
    top: -42,
    flexDirection: 'row',
    backgroundColor: '#1f1f1f',
    borderRadius: 20,
    padding: 5,
    gap: 8,
    borderWidth: 1,
    borderColor: '#333',
    zIndex: 999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  reactionPickerItem: {
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  // Safety overlay styles
  safetyOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
    padding: 20,
  },
  safetyCard: {
    backgroundColor: '#1c1c1c',
    borderRadius: 24,
    padding: 25,
    width: '100%',
    maxWidth: 350,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232, 131, 131, 0.25)',
  },
  safetyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#E88383',
    marginBottom: 12,
  },
  safetyDescription: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  safetyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  safetyButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  safetyCloseButton: {
    marginTop: 15,
    padding: 10,
  },
  safetyCloseText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
});

const TypingIndicator = () => {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current
  ];

  useEffect(() => {
    const animations = dots.map((dot, index) => (
      Animated.sequence([
        Animated.delay(index * 200),
        Animated.loop(
          Animated.sequence([
            Animated.spring(dot, {
              toValue: 1,
              useNativeDriver: true,
              friction: 4,
            }),
            Animated.spring(dot, {
              toValue: 0,
              useNativeDriver: true,
              friction: 4,
            })
          ])
        )
      ])
    ));

    Animated.parallel(animations).start();
    return () => animations.forEach(anim => anim.stop());
  }, []);

  return (
    <View style={styles.typingContainer}>
      {dots.map((dot, index) => (
        <Animated.View
          key={index}
          style={[
            styles.typingDot,
            {
              transform: [{
                translateY: dot.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -8]
                })
              }],
              opacity: dot.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3, 1]
              })
            }
          ]}
        />
      ))}
    </View>
  );
};