import React, { useState, useEffect, useRef } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  TextInput, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert, 
  KeyboardAvoidingView, 
  Platform, 
  ScrollView,
  Animated
} from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';
import { Ionicons } from '@expo/vector-icons';

const ACCENT_COLOR = '#9DC08B'; // Mint green

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      })
    ]).start();
  }, [isLogin]);

  const validateInputs = () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return false;
    }

    if (trimmedPassword.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters long.');
      return false;
    }

    if (!isLogin && trimmedPassword !== confirmPassword.trim()) {
      Alert.alert('Validation Error', 'Passwords do not match.');
      return false;
    }

    return true;
  };

  const handleAuth = async () => {
    if (!validateInputs()) return;

    setLoading(true);
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      } else {
        await createUserWithEmailAndPassword(auth, trimmedEmail, trimmedPassword);
      }
    } catch (error) {
      console.error('Authentication Error:', error);
      let friendlyMessage = 'An error occurred during authentication. Please try again.';
      
      switch (error.code) {
        case 'auth/invalid-email':
          friendlyMessage = 'The email address is invalid.';
          break;
        case 'auth/user-disabled':
          friendlyMessage = 'This user account has been disabled.';
          break;
        case 'auth/user-not-found':
          friendlyMessage = 'No user found with this email.';
          break;
        case 'auth/wrong-password':
          friendlyMessage = 'Incorrect password. Please try again.';
          break;
        case 'auth/email-already-in-use':
          friendlyMessage = 'An account already exists with this email.';
          break;
        case 'auth/weak-password':
          friendlyMessage = 'The password is too weak.';
          break;
        case 'auth/invalid-credential':
          friendlyMessage = 'Invalid credentials. Please verify your email and password.';
          break;
      }
      
      Alert.alert('Authentication Failed', friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
        <Animated.View style={[
          styles.card, 
          { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
        ]}>
          <View style={styles.logoContainer}>
            <View style={styles.iconCircle}>
              <Ionicons name="leaf" size={40} color={ACCENT_COLOR} />
            </View>
            <Text style={styles.title}>Sattva AI</Text>
            <Text style={styles.tagline}>Your AI Wellness Companion</Text>
          </View>

          <Text style={styles.subtitle}>
            {isLogin 
              ? 'Sign in to continue your mental wellness journey.' 
              : 'Create your account to start tracking mood and practicing mindfulness.'}
          </Text>

          {/* Email Input */}
          <View style={styles.inputWrapper}>
            <Ionicons name="mail-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor="#666"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
            />
          </View>

          {/* Password Input */}
          <View style={styles.inputWrapper}>
            <Ionicons name="lock-closed-outline" size={20} color="#666" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#666"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
              autoCapitalize="none"
              textContentType="password"
            />
          </View>

          {/* Confirm Password Input (Sign Up Only) */}
          {!isLogin && (
            <View style={styles.inputWrapper}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm Password"
                placeholderTextColor="#666"
                secureTextEntry
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                autoCapitalize="none"
                textContentType="password"
              />
            </View>
          )}

          <TouchableOpacity 
            style={styles.button}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#111" />
            ) : (
              <Text style={styles.buttonText}>{isLogin ? 'Log In' : 'Sign Up'}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            onPress={() => setIsLogin(!isLogin)}
            style={styles.toggleLink}
          >
            <Text style={styles.toggleText}>
              {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Log In'}
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Feature Highlights Section */}
        <Animated.View style={[
          styles.highlightsContainer,
          { opacity: fadeAnim }
        ]}>
          <Text style={styles.highlightsHeader}>Inside Sattva AI:</Text>
          
          <View style={styles.featureItem}>
            <Ionicons name="chatbubbles-outline" size={22} color={ACCENT_COLOR} style={styles.featureIcon} />
            <View style={styles.featureTextWrapper}>
              <Text style={styles.featureTitle}>AI Mood Chats & Voice Support</Text>
              <Text style={styles.featureDesc}>Speak or type to receive immediate empathetic guidance and sentiment insights.</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="calendar-outline" size={22} color={ACCENT_COLOR} style={styles.featureIcon} />
            <View style={styles.featureTextWrapper}>
              <Text style={styles.featureTitle}>Calendar & Cycle Logging</Text>
              <Text style={styles.featureDesc}>Log your emotional state and track your menstrual cycle predictions in one place.</Text>
            </View>
          </View>

          <View style={styles.featureItem}>
            <Ionicons name="heart-half-outline" size={22} color={ACCENT_COLOR} style={styles.featureIcon} />
            <View style={styles.featureTextWrapper}>
              <Text style={styles.featureTitle}>Interactive Grounding & Breathing</Text>
              <Text style={styles.featureDesc}>Practice visual box breathing and 5-4-3-2-1 grounding exercises dynamically.</Text>
            </View>
          </View>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d0d0d', // Slightly darker background for premium contrast
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    paddingVertical: 40,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#151515',
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)', // Subtle glassmorphic border
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },
  iconCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(157, 192, 139, 0.1)', // Translucent green
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(157, 192, 139, 0.2)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  tagline: {
    fontSize: 13,
    color: ACCENT_COLOR,
    marginTop: 4,
    fontWeight: '500',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  inputWrapper: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    marginBottom: 16,
    paddingHorizontal: 14,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    color: '#fff',
    paddingVertical: 14,
    fontSize: 16,
  },
  button: {
    width: '100%',
    backgroundColor: ACCENT_COLOR,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: ACCENT_COLOR,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 5,
  },
  buttonText: {
    color: '#0d0d0d',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleLink: {
    marginTop: 20,
    padding: 8,
  },
  toggleText: {
    color: ACCENT_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
  highlightsContainer: {
    width: '100%',
    maxWidth: 400,
    marginTop: 30,
    backgroundColor: '#151515',
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.03)',
  },
  highlightsHeader: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 15,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  featureIcon: {
    marginTop: 2,
    marginRight: 12,
  },
  featureTextWrapper: {
    flex: 1,
  },
  featureTitle: {
    color: '#eee',
    fontSize: 14,
    fontWeight: '600',
  },
  featureDesc: {
    color: '#777',
    fontSize: 12,
    marginTop: 3,
    lineHeight: 16,
  }
});
