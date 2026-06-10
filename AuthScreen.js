import React, { useState } from 'react';
import { StyleSheet, Text, View, TextInput, TouchableOpacity, ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from './firebase';

const ACCENT_COLOR = '#9DC08B'; // Mint green to match App.js

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const validateInputs = () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return false;
    }

    // Basic email regex
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
        <View style={styles.card}>
          <Text style={styles.title}>Sattva AI</Text>
          <Text style={styles.subtitle}>
            {isLogin ? 'Welcome back! Sign in to continue your mental wellness journey.' : 'Create your account to start your mental wellness journey.'}
          </Text>

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

          {!isLogin && (
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
          )}

          <TouchableOpacity 
            style={styles.button}
            onPress={handleAuth}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
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
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 30,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: ACCENT_COLOR,
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 20,
  },
  input: {
    width: '100%',
    backgroundColor: '#222',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  button: {
    width: '100%',
    backgroundColor: ACCENT_COLOR,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  toggleLink: {
    marginTop: 20,
    padding: 10,
  },
  toggleText: {
    color: ACCENT_COLOR,
    fontSize: 14,
    fontWeight: '600',
  },
});
