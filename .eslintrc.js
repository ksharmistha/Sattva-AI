// eslint-config-expo v8 targets the eslintrc format (it has no /flat export),
// which is what ESLint 8 uses by default.
module.exports = {
  root: true,
  extends: ['expo'],
  env: {
    browser: true, // React Native provides setTimeout/setInterval/console
    es2021: true,
    jest: true,
  },
  rules: {
    // console.warn/error are used deliberately on degraded paths.
    'no-console': 'off',
  },
};
