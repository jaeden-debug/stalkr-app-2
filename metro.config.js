const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
// Sentry's Metro wrapper emits the Debug ID that ties a bundle to its uploaded
// source map. Without it the maps upload but cannot be matched to the running
// bundle, so production stack traces stay minified.
const { withSentryConfig } = require('@sentry/react-native/metro');

const config = getDefaultConfig(__dirname);

module.exports = withSentryConfig(withNativeWind(config, { input: './global.css' }));
