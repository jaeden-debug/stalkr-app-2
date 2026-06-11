import { ExpoConfig, ConfigContext } from 'expo/config';

const APP_NAME = process.env.EXPO_PUBLIC_APP_NAME || 'Stalkr';
const BUNDLE_ID = process.env.EXPO_PUBLIC_BUNDLE_ID || 'com.stalkr.app';
const ANDROID_PACKAGE = process.env.EXPO_PUBLIC_ANDROID_PACKAGE || 'com.stalkr.app';

export default ({ config }: ConfigContext): any => ({
  ...config,
  name: APP_NAME,
  slug: 'stalkr',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon-stalkr.png',
  userInterfaceStyle: 'dark',
  splash: {
    image: './assets/splash-stalkr.png',
    resizeMode: 'contain',
    backgroundColor: '#080808',
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
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription:
        'Stalkr needs your location to show your position on the map and share it with your crew in real time.',
      NSLocationAlwaysAndWhenInUseUsageDescription:
        'Stalkr needs your location in the background to continue sharing with your crew and alert you when you enter or leave safety zones — even when the app is minimized.',
      NSLocationAlwaysUsageDescription:
        'Stalkr uses background location to keep your crew aware of your position and send zone alerts while you are in the field.',
      NSContactsUsageDescription:
        'Stalkr uses your contacts so you can quickly add emergency contacts to follow your live journey.',
      UIBackgroundModes: ['location', 'fetch', 'remote-notification'],
    },
    // Universal Links — iOS opens the app from https://stalkr.app/invite/*
    // Requires AASA file at https://stalkr.app/.well-known/apple-app-site-association
    associatedDomains: ['applinks:app.navtrl.com'],
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/icon-stalkr-foreground.png',
      backgroundColor: '#080808',
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
      'READ_CONTACTS',
    ],
    config: {
      googleMaps: {
        apiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY,
      },
    },
    // Universal link handling — Android opens the app from https://stalkr.app/invite/*
    intentFilters: [
      {
        action: 'VIEW',
        autoVerify: true,
        data: [
          {
            scheme: 'https',
            host: 'app.navtrl.com',
            pathPrefix: '/invite',
          },
        ],
        category: ['BROWSABLE', 'DEFAULT'],
      },
    ],
  },
  web: {
    favicon: './assets/favicons/favicon-32.png',
    bundler: 'metro',
    output: 'server',
    name: 'Stalkr',
    shortName: 'Stalkr',
    description: 'Know where your people are. Track, share, and stay safe with real-time location awareness, live GPS tracking, safety zones, alerts, and crew coordination.',
    themeColor: '#4ADE80',
    backgroundColor: '#080808',
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
      'expo-contacts',
      {
        contactsPermission:
          'Stalkr uses your contacts so you can quickly add emergency contacts to follow your live journey.',
      },
    ],
    [
      'expo-image-picker',
      {
        photosPermission:
          'Stalkr needs photo library access to let you add photos to markers and saved places.',
        cameraPermission: 'Stalkr needs camera access to capture photos for markers and your profile.',
      },
    ],
    [
      'react-native-maps',
      {
        // Uses react-native-maps/Google subspec on iOS (not the old react-native-google-maps pod)
        iosGoogleMapsApiKey: process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY,
      },
    ],
    [
      'expo-build-properties',
      {
        ios: {
          deploymentTarget: "16.4",
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
