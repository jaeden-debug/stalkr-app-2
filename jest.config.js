/**
 * Map regression suite.
 *
 * These tests exist to prevent the specific defect classes found in the map
 * audit from returning. They deliberately do NOT assert "the component
 * rendered" — every one of those bugs passed a render assertion. They assert
 * lifecycle and isolation instead: identity preservation, render counts, and
 * cross-layer independence.
 */
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-maps|zustand))',
  ],
  testMatch: ['<rootDir>/src/**/*.test.ts', '<rootDir>/src/**/*.test.tsx'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
};
