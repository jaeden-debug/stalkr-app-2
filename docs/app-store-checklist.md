# App Store & Google Play Submission Checklist

## iOS App Store

### Account Setup
- [ ] Apple Developer account active ($99/year)
- [ ] App ID created in Apple Developer Console
- [ ] Bundle ID matches `app.config.ts` → `EXPO_PUBLIC_BUNDLE_ID`
- [ ] Push Notifications capability enabled
- [ ] Location permissions capability enabled
- [ ] In-App Purchase capability enabled (if using native IAP)

### App Store Connect
- [ ] App record created in App Store Connect
- [ ] App name matches brand (`Stalkr`)
- [ ] Category: Navigation or Utilities (or both)
- [ ] Privacy policy URL entered
- [ ] Support URL entered
- [ ] Age rating completed (4+)

### Metadata
- [ ] App description written (< 4000 chars)
- [ ] Promotional text (< 170 chars)
- [ ] Keywords (< 100 chars, comma-separated)
- [ ] Screenshots: 6.7" iPhone, 6.1" iPhone, iPad (if tablet supported)

### Location Permission Review
- [ ] `NSLocationWhenInUseUsageDescription` — clear, non-marketing copy
- [ ] `NSLocationAlwaysAndWhenInUseUsageDescription` — explains safety/tracking purpose
- [ ] Background location usage justified in App Store review notes

### In-App Purchases
- [ ] IAP products created in App Store Connect
- [ ] Products approved before submission
- [ ] Sandbox testing complete

### Build
- [ ] Production build via EAS (`eas build --profile production --platform ios`)
- [ ] Build uploaded to TestFlight
- [ ] Internal testing complete (at least 5 devices)
- [ ] External TestFlight beta (optional)

### Review Notes
Write this in the App Review Information:
```
Stalkr is a real-time location sharing app for outdoor safety.
Background location is used to track crew member positions when
the app is minimized, to maintain situational awareness in hunting,
hiking, and backcountry scenarios. The app displays all crew member
locations on a map. No location data is shared with third parties.

Test credentials: [provide a test account]
```

---

## Google Play

### Account Setup
- [ ] Google Play Console account active ($25 one-time)
- [ ] App created in Google Play Console
- [ ] Package name matches `app.config.ts` → `EXPO_PUBLIC_ANDROID_PACKAGE`
- [ ] Google Maps API key restricted to app's SHA-1 fingerprint

### App Listing
- [ ] Short description (< 80 chars)
- [ ] Full description (< 4000 chars)
- [ ] Category: Maps & Navigation (or Health & Fitness)
- [ ] Privacy policy URL

### Permissions Justification
For `ACCESS_BACKGROUND_LOCATION`:
```
Background location allows Stalkr to track your position and share it
with your crew when the app is not in the foreground. This is core to
the safety mission of the app — hunters and hikers need real-time
location awareness of their crew even when checking other apps.
```

### Google Play Billing
- [ ] In-app products created in Google Play Console
- [ ] Products approved
- [ ] Testing with a licensed tester account

### Build
- [ ] Production build via EAS (`eas build --profile production --platform android`)
- [ ] AAB (Android App Bundle) uploaded to Play Console
- [ ] Internal testing track release
- [ ] Closed testing (at least 3 testers)

### Content Rating
- [ ] Complete IARC questionnaire
- [ ] Target audience: 17+ (for hunting app) or 13+

---

## Both Platforms — Final Checks

- [ ] App icon: 1024×1024 PNG, no alpha channel (iOS), adaptive icon for Android
- [ ] Splash screen correct color (#0a0a0f)
- [ ] All environment variables set in EAS (not in code)
- [ ] Version number incremented (`app.config.ts` → `version`)
- [ ] Crash reporting active (add Sentry or similar in V1.1)
- [ ] Analytics events do NOT include location coordinates
- [ ] No references to beta/test/debug in UI visible to users
- [ ] Terms of service URL accessible
- [ ] Subscription terms clearly shown before purchase
