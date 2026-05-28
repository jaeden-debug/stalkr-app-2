# Stalkr — Setup Guide

## Prerequisites

- Node.js 18+
- npm or yarn
- Expo CLI (`npm install -g expo-cli`)
- EAS CLI (`npm install -g eas-cli`)
- Supabase account
- Apple Developer account (for iOS builds)
- Google Play Console account (for Android builds)

---

## 1. Clone and Install

```bash
git clone <your-repo-url>
cd "stalkr app 2"
npm install
```

---

## 2. Environment Variables

```bash
cp .env.example .env
```

Fill in `.env`:

| Variable | Where to get it |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API |
| `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY` | Google Cloud Console → Maps SDK for iOS |
| `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY` | Google Cloud Console → Maps SDK for Android |
| `EAS_PROJECT_ID` | Run `eas init` and copy the project ID |
| `EXPO_OWNER` | Your Expo username |

---

## 3. Supabase Setup

### 3a. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) and create a new project.
2. Copy the Project URL and anon key into `.env`.

### 3b. Run migrations

In the Supabase SQL editor, run the migrations in order:

```sql
-- 1. Run supabase/migrations/001_initial_schema.sql
-- 2. Run supabase/migrations/002_rls_policies.sql
-- 3. Run supabase/migrations/003_realtime_and_functions.sql
```

Or use the Supabase CLI:
```bash
npx supabase db push
```

### 3c. Enable Realtime

In Supabase Dashboard → Database → Replication, enable the following tables:
- `live_locations`
- `markers`
- `saved_places`
- `group_events`
- `rally_points`
- `check_in_timers`

### 3d. Storage buckets

Create these storage buckets in Supabase Dashboard → Storage:
- `avatars` — public
- `marker-photos` — public
- `zone-photos` — public

---

## 4. Google Maps Setup

### iOS
1. Go to Google Cloud Console → APIs & Services → Enable Maps SDK for iOS.
2. Create an API key, restrict it to iOS with your bundle ID.
3. Add to `.env` as `EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY`.

### Android
1. Enable Maps SDK for Android in Google Cloud Console.
2. Create an API key restricted to Android with your package name and SHA-1.
3. Add to `.env` as `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`.

---

## 5. EAS Build Setup

```bash
eas login
eas init
```

Update `eas.json` with your Apple ID and Google service account path if submitting.

### Build for development (device)
```bash
eas build --platform ios --profile development
eas build --platform android --profile development
```

### Build for TestFlight / Play testing
```bash
eas build --platform ios --profile preview
eas build --platform android --profile preview
```

### Production build
```bash
eas build --platform all --profile production
```

---

## 6. Push Notifications Setup

Expo handles push notifications via FCM (Android) and APNs (iOS).

### iOS
- An Apple Push Notification certificate is configured automatically by EAS Build.
- Ensure "Push Notifications" is enabled in your App ID in Apple Developer Console.

### Android
- Add your `google-services.json` to the project root.
- EAS Build handles FCM setup automatically.

---

## 7. RevenueCat Setup (Recommended for in-app purchases)

1. Create a [RevenueCat](https://revenuecat.com) account.
2. Add your iOS app (bundle ID) and Android app (package name).
3. Configure products in App Store Connect and Google Play Console.
4. Link them in RevenueCat.
5. Add API keys to `.env`:
   ```
   EXPO_PUBLIC_REVENUECAT_IOS_API_KEY=appl_...
   EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY=goog_...
   ```
6. Install RevenueCat SDK: `npm install react-native-purchases`
7. Update `src/services/billing.ts` to use the RevenueCat adapter.

---

## 8. Start Development

```bash
npx expo start
```

Scan the QR code with Expo Go or your development build.

---

## 9. Checklist Before First Build

- [ ] All `.env` variables filled in
- [ ] Supabase migrations applied
- [ ] Realtime tables enabled in Supabase
- [ ] Storage buckets created
- [ ] Google Maps API keys working
- [ ] EAS project initialized
- [ ] App icon placed at `assets/icon.png`
- [ ] Splash screen placed at `assets/splash.png`
