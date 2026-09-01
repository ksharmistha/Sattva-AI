/**
 * Render smoke tests.
 *
 * These mount each screen against a mocked Firebase so the authenticated
 * screens are exercised without a real account. They catch broken imports,
 * bad JSX and undefined references - the things most likely to break during
 * a refactor.
 */
import React from 'react';
import renderer, { act } from 'react-test-renderer';

const mockUser = { uid: 'test-uid' };

// @expo/vector-icons touches expo-font's native module at construction time,
// which is not available under jest. Every icon set renders as a plain view.
jest.mock('@expo/vector-icons', () => {
  const ReactLib = require('react');
  const { View } = require('react-native');
  const Icon = (props) => ReactLib.createElement(View, { testID: `icon-${props.name}` });
  return new Proxy({}, { get: () => Icon });
});

jest.mock('../firebase', () => ({
  db: {},
  auth: { currentUser: { uid: 'test-uid' } },
  firebaseReady: true,
}));

jest.mock('firebase/firestore', () => ({
  collection: jest.fn(() => ({})),
  query: jest.fn(() => ({})),
  where: jest.fn(() => ({})),
  orderBy: jest.fn(() => ({})),
  limit: jest.fn(() => ({})),
  getDocs: jest.fn(async () => ({ docs: [], forEach: () => {} })),
  getDoc: jest.fn(async () => ({ exists: () => false, data: () => ({}) })),
  doc: jest.fn(() => ({})),
  addDoc: jest.fn(async () => ({ id: 'new-doc' })),
  setDoc: jest.fn(async () => undefined),
  updateDoc: jest.fn(async () => undefined),
}));

jest.mock('firebase/auth', () => ({
  onAuthStateChanged: jest.fn((auth, cb) => {
    cb(mockUser);
    return () => {};
  }),
  signOut: jest.fn(async () => undefined),
  signInWithEmailAndPassword: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  getAuth: jest.fn(() => ({})),
  initializeAuth: jest.fn(() => ({})),
}));

const renderScreen = async (Component, props = {}) => {
  let tree;
  await act(async () => {
    tree = renderer.create(<Component {...props} />);
  });
  return tree;
};

const navigation = { setOptions: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };

describe('screen render smoke tests', () => {
  it('renders AuthScreen', async () => {
    const AuthScreen = require('../AuthScreen').default;
    const tree = await renderScreen(AuthScreen);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders ExercisesScreen', async () => {
    const ExercisesScreen = require('../ExercisesScreen').default;
    const tree = await renderScreen(ExercisesScreen);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders StatsScreen and computes stats without crashing', async () => {
    const StatsScreen = require('../StatsScreen').default;
    const tree = await renderScreen(StatsScreen, { navigation });
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders CalendarScreen', async () => {
    const CalendarScreen = require('../CalendarScreen').default;
    const tree = await renderScreen(CalendarScreen);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders the full App tree including navigation', async () => {
    const App = require('../App').default;
    const tree = await renderScreen(App);
    expect(tree.toJSON()).toBeTruthy();
  });
});
