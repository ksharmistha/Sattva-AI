// Expo's preset handles JSX, TypeScript, Reanimated and env inlining.
//
// The previous config also registered `react-native-dotenv` to expose an
// `@env` module, but nothing ever imported from it. Configuration now flows
// through EXPO_PUBLIC_* variables (inlined by the Expo CLI) and lib/env.js.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
