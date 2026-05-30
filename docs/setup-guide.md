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
| `EXPO_PUBLIC_SENTRY_DSN` | Sentry Dashboard → Project → Settings → Client Keys |
| `EXPO_PUBLIC_POSTHOG_API_KEY` | PostHog → Project Settings → Project API Key |
| `EXPO_PUBLIC_POSTHOG_HOST` | Optional — defaults to `https://us.i.posthog.com` |
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

## 7. Crash Reporting — Sentry

1. Create a project at [sentry.io](https://sentry.io) → New Project → React Native.
2. Copy the DSN and add it to `.env` as `EXPO_PUBLIC_SENTRY_DSN`.
3. Add the Sentry plugin to `app.config.ts` plugins array for source map uploads:
   ```ts
   ['@sentry/react-native/expo', { organization: 'your-org', project: 'your-project' }]
   ```
4. On EAS builds, add `SENTRY_AUTH_TOKEN` as an EAS secret:
   ```bash
   eas secret:create --scope project --name SENTRY_AUTH_TOKEN --value <token>
   ```
   Get the token from Sentry → Settings → Auth Tokens.

Sentry is no-op if `EXPO_PUBLIC_SENTRY_DSN` is not set (safe for local dev without a key).

---

## 8. Analytics — PostHog

1. Create a project at [posthog.com](https://posthog.com) (cloud) or self-host.
2. Copy the Project API Key and add to `.env` as `EXPO_PUBLIC_POSTHOG_API_KEY`.
3. If self-hosting, also set `EXPO_PUBLIC_POSTHOG_HOST` to your instance URL.

PostHog is no-op if `EXPO_PUBLIC_POSTHOG_API_KEY` is not set.

---

## 9. Invite Link Social Previews (Web)

Invite links at `https://stalkr.app/invite/CODE` render a branded web landing page with full OG/Twitter card metadata for iMessage, Discord, Slack, X, WhatsApp, etc.

### Deploy the web build
```bash
npx expo export --platform web
```
Deploy the `dist/` folder to Vercel, Netlify, or any static host pointed at `stalkr.app`.

### Universal Links (iOS — required for "Open in App" from links)
1. In `public/.well-known/apple-app-site-association`, replace `TEAMID` with your 10-character Apple Team ID (found in Apple Developer Console → Membership).
2. Ensure the file is served at `https://stalkr.app/.well-known/apple-app-site-association` with `Content-Type: application/json` and **no redirect**.
3. `associatedDomains: ['applinks:stalkr.app']` is already set in `app.config.ts`.

### Android App Links (required for "Open in App" from links)
1. Get your app's SHA-256 signing fingerprint:
   ```bash
   eas credentials --platform android
   ```
2. Replace `REPLACE_WITH_YOUR_APP_SIGNING_CERT_SHA256_FINGERPRINT` in `public/.well-known/assetlinks.json`.
3. Serve the file at `https://stalkr.app/.well-known/assetlinks.json`.

### Social preview image
The OG image is served from `https://stalkr.app/assets/social/stalkr-group-invite-live-location-sharing-social-preview.png` (1200×630). Ensure this path is accessible after deploying the web build.

### Invite page App Store IDs
In `app/invite/[code]+web.tsx`, replace:
- `id0000000000` with your real App Store numeric ID
- The TestFlight URL with your real TestFlight join link
- `app-id=0000000000` in the `apple-itunes-app` meta tag

---

## 10. RevenueCat Setup (Recommended for in-app purchases)

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

## 11. Start Development

```bash
npx expo start
```

Scan the QR code with Expo Go or your development build.

---

## 12. Checklist Before First Build

- [ ] All `.env` variables filled in
- [ ] Supabase migrations applied
- [ ] Realtime tables enabled in Supabase
- [ ] Storage buckets created
- [ ] Google Maps API keys working
- [ ] EAS project initialized
- [ ] `eas.json` — replace `your-apple-id@email.com`, `your-apple-team-id`, `your-app-store-connect-app-id`
- [ ] Sentry DSN set + Sentry plugin added to `app.config.ts`
- [ ] PostHog API key set
- [ ] App icon placed at `assets/icon.png`
- [ ] Splash screen placed at `assets/splash.png`
- [ ] Social preview image at `assets/social/stalkr-group-invite-live-location-sharing-social-preview.png`
- [ ] `public/.well-known/apple-app-site-association` — replace `TEAMID`
- [ ] `public/.well-known/assetlinks.json` — replace SHA-256 fingerprint
- [ ] `app/invite/[code]+web.tsx` — replace App Store ID and TestFlight URL
- [ ] Web build deployed to `stalkr.app` with AASA and assetlinks files accessible
- [ ] IAP purchase flow wired (see `src/services/billing.ts` TODOs)
