import { ExpoConfig, ConfigContext } from 'expo/config';

const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Stalkr';
const BUNDLE_ID = process.env.EXPO_PUBLIC_BUNDLE_ID || 'com.stalkr.app';
const ANDROID_PACKAGE = process.env.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.stalkr.app';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: APP_NAME,
  slug: 'stalkr',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0a0f',
  },
  updates: {
    fallbackToCacheTimeout: 0,
  },
  assetBundlePatterns: ['**/*'],
  ios: {
    supportsTablet: false,
    bundleIdentifier: BUNDLE_ID,
    buildNumber: '1',
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        'Stalkr needs your location to show your position on the map and share it with your crew in real time.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Stalkr needs your location in the background to continue sharing with your crew and alert you when you enter or leave safety zones — even when the app is minimized.',
      NSLocationAlwaysUsageDescription:
        'Stalkr uses background location to keep your crew aware of your position and send zone alerts while you are in the field.',
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
    },
    config: {
      googleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY,
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#0a0a0f',
    },
    package: ANDROID_PACKAGE,
    versionCode: 1,
    permissions: [
      'ACCESS_COARSE_LOCATION',
      'ACCESS_FINE_LOCATION',
      'ACCESS_BACKGROUND_LOCATION',
      'FOREGROUND_SERVICE',
      'FOREGROUND_SERVICE_LOCATION',
      'RECEIVE_BOOT_COMPLETED',
      'VIBRATE',
      'POST_NOTIFICATIONS',
    ],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY,
      },
    },
  },
  web: {
    favicon: './assets/favicon.png',
  },
  extra: {
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: process.env.EAS_PROJECT_ID || 'cad26275-191d-468c-9cd0-32683adc5501',
    },
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-location',
    'expo-notifications',
    [
      'expo-image-picker',
      {
        photosPermission:
          'Stalkr needs photo library access to let you add photos to markers and saved places.',
        cameraPermission: 'Stalkr needs camera access to capture photos for markers and your profile.',
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: '15.0',
        },
        android: {
          compileSdkVersion: 34,
          targetSdkVersion: 34,
          buildToolsVersion: '34.0.0',
        },
      },
    ],
  ],
  scheme: 'stalkr',
  owner: process.env.EXPO_OWNER,
});
