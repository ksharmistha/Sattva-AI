import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View, TouchableOpacity, TextInput, Image, ScrollView, ActivityIndicator, Alert, Animated, Platform } from 'react-native';
import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import CalendarScreen from './CalendarScreen';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, updateDoc, addDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { Ionicons } from '@expo/vector-icons';
import ExercisesScreen from './ExercisesScreen';
import StatsScreen from './StatsScreen';

// Auth Imports
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './firebase';
import AuthScreen from './AuthScreen';

// Speech & HF AI Imports
import { useSpeechToText } from './speech';
import { queryHuggingFace } from './huggingface';

const Stack = createStackNavigator();
const ACCENT_COLOR = '#9DC08B';

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
    <TouchableOpacity onPress={handlePress}>
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

// HomeScreen component
function HomeScreen({ navigation }) {
  const scrollViewRef = useRef(null);
  const [mood, setMood] = useState(null);
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [isMessageLoading, setIsMessageLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  // Speech Recognition hook
  const { isListening, startListening, stopListening, isSupported } = useSpeechToText({
    onResults: (text) => {
      setMessage(text);
    },
    onError: (err) => {
      console.warn('Speech recognition error:', err);
      Alert.alert('Voice Input Info', 'Speech recognition was interrupted or is not configured. Please type your message.');
    }
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

  // Update your message handling function
  const handleSendMessage = async () => {
    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;
    if (!auth.currentUser) return;

    const userMessageId = Date.now().toString();
    const userTimestamp = new Date().toISOString();
    
    const userMessage = {
      id: userMessageId,
      text: trimmedMessage,
      isUser: true,
      timestamp: userTimestamp,
      reactions: []
    };

    try {
      setIsMessageLoading(true);
      setMessage('');  // Clear input
      setMessages(prev => [...prev, userMessage]);  // Add user message immediately
      
      // Save User Message to Firestore
      const userDocRef = await addDoc(collection(db, 'messages'), {
        userId: auth.currentUser.uid,
        text: trimmedMessage,
        isUser: true,
        timestamp: userTimestamp,
        reactions: []
      });

      // Get AI response
      let aiResponseText = await queryHuggingFace(trimmedMessage, mood);
      
      // Fallback to local rule-based engine if HF fails or offline
      if (!aiResponseText) {
        aiResponseText = await generateAIResponse(trimmedMessage, mood);
      }
      
      const aiTimestamp = new Date().toISOString();
      
      // Save AI Message to Firestore
      const aiDocRef = await addDoc(collection(db, 'messages'), {
        userId: auth.currentUser.uid,
        text: aiResponseText,
        isUser: false,
        timestamp: aiTimestamp,
        reactions: []
      });

      if (aiResponseText) {
        const aiMessage = {
          id: aiDocRef.id,
          text: aiResponseText,
          isUser: false,
          timestamp: aiTimestamp,
          reactions: []
        };
        // Update messages: swap temporary user message ID with firestore ID, and append AI message
        setMessages(prev => {
          const updated = prev.map(m => m.id === userMessageId ? { ...m, id: userDocRef.id } : m);
          return [...updated, aiMessage];
        });
      }

    } catch (err) {
      console.error('Message Error:', err);
      Alert.alert('Send Error', 'Failed to send message. Please check your network.');
    } finally {
      setIsMessageLoading(false);
    }
  };

  const handleReaction = async (messageId, reaction) => {
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

  // Load messages on mount and when user logs in
  useEffect(() => {
    const loadMessages = async () => {
      if (!auth.currentUser) return;
      try {
        const q = query(
          collection(db, 'messages'),
          where('userId', '==', auth.currentUser.uid),
          orderBy('timestamp', 'desc'),
          limit(50)
        );
        const querySnapshot = await getDocs(q);
        const fetchedMessages = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMessages(fetchedMessages.reverse());
      } catch (err) {
        console.error('Error loading messages:', err);
      }
    };

    loadMessages();
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
          <Ionicons name="log-out-outline" size={24} color="#fff" />
        </TouchableOpacity>
      ),
      headerRight: () => (
        <View style={styles.headerButtons}>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Stats')}
          >
            <Ionicons name="stats-chart" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Exercises')}
          >
            <Ionicons name="leaf-outline" size={24} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerButton}
            onPress={() => navigation.navigate('Calendar')}
          >
            <Ionicons name="calendar-outline" size={24} color="#fff" />
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
        "You're feeling neutral - that's perfectly okay. Would you like to talk about your day?",
        "Sometimes a neutral state helps us think clearly. What's on your mind?",
        "Taking things as they come? Let me know if you'd like to explore your feelings further."
      ],
      Sad: [
        "I'm here for you during this difficult time. Would you like to talk about what's troubling you?",
        "It's okay to feel sad. I'm here to listen if you want to share what's on your mind.",
        "Thank you for sharing how you feel. Would you like to talk about what's making you sad?"
      ],
      Stressed: [
        "I notice you're feeling stressed. Would you like to talk about what's causing this pressure?",
        "Stress can be overwhelming. Let's work through this together - what's on your mind?",
        "I'm here to help you manage this stress. Want to tell me what's troubling you?"
      ]
    };

    const moodResponses = responses[selectedMood];
    return moodResponses[Math.floor(Math.random() * moodResponses.length)];
  };

  // Update the mood setting logic in HomeScreen
  const handleMoodSelection = async (selectedMood) => {
    setMood(selectedMood);
    if (!auth.currentUser) return;

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      
      // Save mood to unified moods collection
      const moodDocRef = doc(db, 'moods', `${auth.currentUser.uid}_${todayStr}`);
      await setDoc(moodDocRef, {
        userId: auth.currentUser.uid,
        date: todayStr,
        mood: selectedMood,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error('Error saving mood selection:', err);
    }
    
    // Add AI response for mood selection
    const aiResponseText = getMoodSelectionResponse(selectedMood);
    const aiTimestamp = new Date().toISOString();
    let aiMessageId = Date.now().toString() + '-ai';

    try {
      const aiDocRef = await addDoc(collection(db, 'messages'), {
        userId: auth.currentUser.uid,
        text: aiResponseText,
        isUser: false,
        timestamp: aiTimestamp,
        reactions: []
      });
      aiMessageId = aiDocRef.id;
    } catch (err) {
      console.error('Error saving mood AI message:', err);
    }
    
    const aiMessage = {
      id: aiMessageId,
      text: aiResponseText,
      isUser: false,
      timestamp: aiTimestamp,
      reactions: []
    };
    
    setMessages(prev => [...prev, aiMessage]);
  };

  const handleVoicePress = () => {
    if (!isSupported) {
      Alert.alert('Voice Input', 'Speech recognition is not supported in this browser/device.');
      return;
    }
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <View style={styles.container}>
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

      <ScrollView 
        ref={scrollViewRef}
        style={styles.chatScrollView}
        contentContainerStyle={styles.chatContentContainer}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map((msg) => (
          <ChatMessage 
            key={msg.id}
            message={msg}
            isUser={msg.isUser}
            onReact={handleReaction}
          />
        ))}
        {isMessageLoading && <TypingIndicator />}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TouchableOpacity 
          style={[styles.voiceButton, isListening && { backgroundColor: '#E88383' }]}
          onPress={handleVoicePress}
        >
          <Ionicons name={isListening ? "mic" : "mic-outline"} size={24} color="#fff" />
        </TouchableOpacity>
        
        <TextInput
          style={[styles.chatInput, { color: '#fff' }]}
          placeholder={isListening ? "Listening..." : "Type a message..."}
          placeholderTextColor="#666"
          value={message}
          onChangeText={setMessage}
        />
        
        <TouchableOpacity 
          style={styles.sendButton}
          onPress={handleSendMessage}
        >
          <Text style={styles.sendButtonText}>Send</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ChatMessage Component
const ChatMessage = ({ message, isUser }) => {
  return (
    <View style={[
      styles.messageContainer,
      isUser ? styles.userMessage : styles.aiMessage
    ]}>
      <Text style={styles.messageText}>{message.text}</Text>
    </View>
  );
};

// Main App component with Firebase Auth Conditional Navigation
export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (usr) => {
      setUser(usr);
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  if (authLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={ACCENT_COLOR} />
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
            borderBottomColor: '#333',
          },
          headerTintColor: '#fff',
          cardStyle: { backgroundColor: '#111' },
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  welcomeSection: {
    padding: 20,
    backgroundColor: '#1a1a1a',
  },
  chatScrollView: {
    flex: 1,
    paddingHorizontal: 15,
  },
  chatContentContainer: {
    paddingTop: 10,
    paddingBottom: 20,
  },
  welcomeTitle: {
    color: ACCENT_COLOR,
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  welcomeDescription: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
    opacity: 0.9,
  },
  divider: {
    height: 2,
    backgroundColor: ACCENT_COLOR,
    opacity: 0.2,
    marginTop: 15,
  },
  title: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 20,
    marginBottom: 15,
  },
  moodContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 15,
    marginBottom: 15,
  },
  moodButton: {
    backgroundColor: '#222',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: 'center',
    minWidth: 90,
  },
  moodButtonSelected: {
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: ACCENT_COLOR,
  },
  moodEmoji: {
    fontSize: 28,
    marginBottom: 6,
  },
  moodLabel: {
    color: '#fff',
    fontSize: 13,
  },
  inputContainer: {
    flexDirection: 'row',
    padding: 10,
    backgroundColor: '#1a1a1a',
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'center',
    gap: 10,
  },
  chatInput: {
    flex: 1,
    backgroundColor: '#222',
    borderRadius: 20,
    paddingHorizontal: 15,
    paddingVertical: 10,
    fontSize: 16,
    color: '#fff',
    minHeight: 40,
  },
  sendButton: {
    width: 60,
    height: 40,
    borderRadius: 20,
    backgroundColor: ACCENT_COLOR,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonText: {
    fontSize: 15,
    color: '#111',
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
    backgroundColor: '#1a1a1a',
    padding: 8,
    borderRadius: 12,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerAppName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  headerButtons: {
    flexDirection: 'row',
    gap: 10,
    marginRight: 15,
  },
  headerButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#222',
  },
  typingContainer: {
    flexDirection: 'row',
    padding: 15,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 5,
  },
  typingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: ACCENT_COLOR,
  },
  messageContainer: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 15,
    marginVertical: 4,
  },
  userMessage: {
    backgroundColor: ACCENT_COLOR,
    alignSelf: 'flex-end',
    marginLeft: 'auto',
    marginRight: 10,
  },
  aiMessage: {
    backgroundColor: '#222',
    alignSelf: 'flex-start',
    marginLeft: 10,
    marginRight: 'auto',
    borderWidth: 1,
    borderColor: '#333',
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    lineHeight: 24,
  },
  voiceButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#222',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
});

const generateAIResponse = async (userMessage, currentMood) => {
  const msg = userMessage.toLowerCase();
  
  if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey')) {
    return "Hello! How can I support you today? 😊";
  }
  
  if (msg.includes('bye') || msg.includes('goodbye')) {
    return "Take care! Remember, I'm here whenever you need support. 🌟";
  }

  const moodResponses = {
    Happy: {
      default: [
        "That's wonderful! What's making you feel particularly happy today?",
        "I love seeing you in good spirits! Would you like to share more?",
        "Your positive energy is infectious! What's the highlight of your day?",
      ],
      why: [
        "It's great that you're feeling happy! Sometimes understanding what makes us happy helps us create more joyful moments.",
        "Exploring what brings us joy can help us appreciate these moments even more. Would you like to share?",
      ],
      help: [
        "While you're feeling good, this might be a great time to plan some future activities that bring you joy!",
        "It's wonderful that you're feeling happy! Would you like to explore ways to maintain this positive energy?",
      ],
    },
    Sad: {
      default: [
        "I hear you, and it's okay to feel sad. Would you like to talk about what's troubling you?",
        "I'm here to listen without judgment. What's on your mind?",
        "Sometimes sharing our feelings can help lighten the load. What's making you feel this way?",
      ],
      why: [
        "It's brave of you to explore these feelings. Would you like to talk about what might be causing this sadness?",
        "Understanding our sadness can be the first step toward feeling better. What do you think triggered these feelings?",
      ],
      help: [
        "Let's work through this together. Would you like to try some simple activities that might help lift your mood?",
        "There are several ways we can approach this. Would you like to explore some coping strategies?",
      ],
    },
    Stressed: {
      default: [
        "I understand stress can feel overwhelming. What's causing you the most pressure right now?",
        "Let's take a deep breath together. Would you like to talk about what's stressing you?",
        "Sometimes breaking down our stressors can make them feel more manageable. What's on your mind?",
      ],
      why: [
        "Understanding our stress triggers can help us manage them better. What do you think is contributing to your stress?",
        "Let's explore what's causing this stress. Is it something specific, or a combination of factors?",
      ],
      help: [
        "I know some relaxation techniques that might help. Would you like to try one?",
        "There are several ways we can approach stress management. Would you like to explore some strategies?",
      ],
    },
    Calm: {
      default: [
        "It's wonderful that you're feeling calm. What's helping you maintain this peaceful state?",
        "Moments of calm are precious. How did you achieve this sense of peace?",
        "This is a great state of mind. What activities helped you reach this calm?",
      ],
      why: [
        "Understanding what brings us calm can help us return to this state when we need it. What worked for you?",
        "It's valuable to recognize what helps us feel peaceful. Would you like to explore what contributed to this?",
      ],
      help: [
        "Would you like to learn some techniques to help maintain this calm state?",
        "This calm state is a great foundation. Would you like to explore ways to extend it?",
      ],
    },
    Neutral: {
      default: [
        "A neutral state can be a good place for reflection. How would you like to feel?",
        "Sometimes neutral is exactly what we need. What's on your mind?",
        "This could be a good time to set intentions. What would you like to focus on?",
      ],
      why: [
        "Neutral moments can be valuable for self-reflection. Would you like to explore what you're thinking about?",
        "Sometimes a neutral state helps us see things clearly. What's on your mind?",
      ],
      help: [
        "Would you like to explore ways to move toward a positive direction?",
        "This could be a good time to try something new. Would you like some suggestions?",
      ],
    },
  };

  const moodSet = moodResponses[currentMood] || moodResponses.Neutral;
  
  if (msg.includes('why')) {
    return moodSet.why[Math.floor(Math.random() * moodSet.why.length)];
  }
  
  if (msg.includes('help') || msg.includes('what should i do')) {
    return moodSet.help[Math.floor(Math.random() * moodSet.help.length)];
  }
  
  return moodSet.default[Math.floor(Math.random() * moodSet.default.length)];
};

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
                  outputRange: [0, -10]
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