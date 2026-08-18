/**
 * Invite landing page — web platform only  (app/invite/[code]+web.tsx)
 *
 * Expo Router picks this file over [code].tsx when building for web.
 *
 * Responsibilities:
 *   1. Inject OG / Twitter card meta tags so social crawlers (iMessage,
 *      Discord, Slack, X, Facebook, WhatsApp, Telegram, etc.) generate
 *      rich previews for  https://stalkr.app/invite/CODE
 *   2. Render a branded landing page with group name + member count
 *   3. "Open in Stalkr" button  →  stalkr://invite/CODE  (app deep link)
 *   4. App Store / TestFlight fallback when the app is not installed
 *   5. Gracefully handle invalid / expired invite codes
 *
 * OG image:
 *   assets/social/stalkr-group-invite-live-location-sharing-social-preview.png
 *   Served at: https://stalkr.app/assets/social/<filename>
 *   Dimensions: 1200 × 630  (optimal for all major platforms)
 */
import Head from 'expo-router/head';
import { useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from 'react-native';
import { supabaseWeb } from '@/services/supabase.web';
import { track } from '@/services/analytics';

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCTION_ORIGIN = 'https://app.navtrl.com';
// Set EXPO_PUBLIC_APP_STORE_ID + EXPO_PUBLIC_TESTFLIGHT_CODE once the app is live
// in App Store Connect. Falls back to placeholders for preview builds.
const APP_STORE_ID = process.env.EXPO_PUBLIC_APP_STORE_ID || '0000000000';
const TESTFLIGHT_CODE = process.env.EXPO_PUBLIC_TESTFLIGHT_CODE || 'XXXXXXXXXX';
const APP_STORE_URL = `https://apps.apple.com/app/stalkr/id${APP_STORE_ID}`;
const TESTFLIGHT_URL = `https://testflight.apple.com/join/${TESTFLIGHT_CODE}`;
const OG_IMAGE_URL = `${PRODUCTION_ORIGIN}/stalkr-crew-invite-og-image.png`;

const META_TITLE = 'Join Our Crew';
const META_DESCRIPTION =
  'Track locations, stay connected, and explore safely together.';

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'loading' | 'found' | 'invalid';

interface GroupPreview {
  name: string;
  memberCount: number;
  inviteCode: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function InviteWebPage() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const [phase, setPhase] = useState<Phase>('loading');
  const [group, setGroup] = useState<GroupPreview | null>(null);

  // Canonical URL for this invite
  const canonicalUrl = `${PRODUCTION_ORIGIN}/invite/${code ?? ''}`;
  // App deep link
  const deepLink = `stalkr://invite/${code?.toUpperCase() ?? ''}`;

  // ── Fetch group preview ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!code) {
      setPhase('invalid');
      return;
    }

    (async () => {
      try {
        // Public invite preview via RPC.
        //
        // This used to select from `groups` directly, but groups_select is
        // USING (is_group_member(id)) and this page runs as anon — so it matched
        // nothing and EVERY invite link rendered "invalid". peek_crew_invite is
        // SECURITY DEFINER and returns only the name and member count to a
        // caller holding a valid code.
        const { data: peek, error: groupErr } = await supabaseWeb
          .rpc('peek_crew_invite', { p_code: code.toUpperCase() });

        const groupData = Array.isArray(peek) ? peek[0] : peek;

        if (groupErr || !groupData) {
          setPhase('invalid');
          track({ name: 'invite_page_viewed', properties: { valid: false } });
          return;
        }

        setGroup({
          name: groupData.name,
          memberCount: Number(groupData.member_count ?? 0),
          inviteCode: code.toUpperCase(),
        });
        setPhase('found');
        track({ name: 'invite_page_viewed', properties: { valid: true } });
      } catch {
        setPhase('invalid');
      }
    })();
  }, [code]);

  // ── Dynamic meta values ─────────────────────────────────────────────────────
  const pageTitle =
    phase === 'found' && group
      ? `Join "${group.name}" on Stalkr`
      : META_TITLE;

  const pageDescription =
    phase === 'found' && group
      ? `${group.name} has invited you to join their Stalkr crew (${group.memberCount} member${group.memberCount === 1 ? '' : 's'}). Real-time location sharing, live crew tracking, safety zones, and outdoor awareness.`
      : META_DESCRIPTION;

  // ── Handlers ────────────────────────────────────────────────────────────────
  const handleOpenApp = () => {
    if (Platform.OS === 'web') {
      // Try deep link; if the app isn't installed the browser will fall through
      window.location.href = deepLink;
      // Fallback: after 2s redirect to App Store if page is still visible
      setTimeout(() => {
        if (!document.hidden) {
          window.location.href = APP_STORE_URL;
        }
      }, 2000);
    } else {
      Linking.openURL(deepLink).catch(() => Linking.openURL(APP_STORE_URL));
    }
  };

  const handleGetApp = () => {
    const url =
      APP_STORE_URL !== 'https://apps.apple.com/app/stalkr/id0000000000'
        ? APP_STORE_URL
        : TESTFLIGHT_URL;
    if (Platform.OS === 'web') {
      window.open(url, '_blank');
    } else {
      Linking.openURL(url);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Head / Meta ─────────────────────────────────────────────────── */}
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />

        {/* Canonical */}
        <link rel="canonical" href={canonicalUrl} />

        {/* Open Graph */}
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:image"        content={OG_IMAGE_URL} />
        <meta property="og:image:type"   content="image/png" />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt"    content="Stalkr — real-time crew location sharing" />
        <meta property="og:site_name"    content="Stalkr" />

        {/* Twitter / X */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:site"        content="@stalkrapp" />
        <meta name="twitter:title"       content={pageTitle} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image"       content={OG_IMAGE_URL} />
        <meta name="twitter:image:alt"   content="Stalkr — real-time crew location sharing" />

        {/* iOS Smart App Banner — shows "Open in Stalkr" natively on Safari */}
        {/* Replace app-id with real App Store numeric ID */}
        <meta
          name="apple-itunes-app"
          content={`app-id=${APP_STORE_ID}, app-argument=${deepLink}`}
        />

        {/* Theme */}
        <meta name="theme-color" content="#080808" />
        <meta name="color-scheme" content="dark" />

        {/* Prevent indexing of invalid/expired invite codes */}
        {phase === 'invalid' && <meta name="robots" content="noindex" />}
      </Head>

      {/* ── Page Body ───────────────────────────────────────────────────── */}
      <View style={styles.root}>
        {/* Background grid lines for tactical feel */}
        <View style={styles.gridOverlay} pointerEvents="none" />

        {/* Logo / brand mark */}
        <View style={styles.brandRow}>
          <View style={styles.logoDot} />
          <Text style={styles.brandName}>STALKR</Text>
        </View>

        {/* ── Loading ──────────────────────────────────────────────────── */}
        {phase === 'loading' && (
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#22c55e" />
            <Text style={styles.loadingText}>Verifying invite...</Text>
          </View>
        )}

        {/* ── Found ────────────────────────────────────────────────────── */}
        {phase === 'found' && group && (
          <View style={styles.card}>
            {/* Radar icon */}
            <View style={styles.radarWrap}>
              <View style={styles.radarOuter} />
              <View style={styles.radarInner} />
              <Text style={styles.radarEmoji}>📡</Text>
            </View>

            <Text style={styles.eyebrow}>CREW INVITE</Text>
            <Text style={styles.groupName}>{group.name}</Text>

            {/* Stats row */}
            <View style={styles.statsRow}>
              <View style={styles.statPill}>
                <View style={[styles.statusDot, styles.dotLive]} />
                <Text style={styles.statText}>
                  {group.memberCount} member{group.memberCount === 1 ? '' : 's'}
                </Text>
              </View>
              <View style={styles.statPill}>
                <Text style={styles.statText}>📍 Live tracking</Text>
              </View>
            </View>

            <Text style={styles.description}>
              You've been invited to join this crew. Accept to share your
              real-time location with them and receive safety zone alerts.
            </Text>

            {/* Invite code badge */}
            <View style={styles.codeBox}>
              <Text style={styles.codeLabel}>INVITE CODE</Text>
              <Text style={styles.codeText}>{group.inviteCode}</Text>
            </View>

            {/* Primary CTA */}
            <TouchableOpacity
              style={styles.openBtn}
              onPress={handleOpenApp}
              activeOpacity={0.85}
            >
              <Text style={styles.openBtnText}>OPEN IN STALKR</Text>
            </TouchableOpacity>

            {/* Secondary — app not installed */}
            <TouchableOpacity
              style={styles.storeBtn}
              onPress={handleGetApp}
              activeOpacity={0.8}
            >
              <Text style={styles.storeBtnText}>
                🍎 Get Stalkr on the App Store
              </Text>
            </TouchableOpacity>

            <Text style={styles.hint}>
              Tap "Open in Stalkr" — if the app isn't installed yet, you'll be
              redirected to the App Store automatically.
            </Text>
          </View>
        )}

        {/* ── Invalid ───────────────────────────────────────────────────── */}
        {phase === 'invalid' && (
          <View style={styles.card}>
            <Text style={styles.radarEmoji}>⚠️</Text>
            <Text style={styles.eyebrow}>INVITE NOT FOUND</Text>
            <Text style={styles.invalidTitle}>Link expired or invalid</Text>
            <Text style={styles.description}>
              This invite link is no longer active. Ask the crew owner to share
              a fresh invite code, or download Stalkr to create your own crew.
            </Text>

            <TouchableOpacity
              style={styles.storeBtn}
              onPress={handleGetApp}
              activeOpacity={0.8}
            >
              <Text style={styles.storeBtnText}>
                🍎 Get Stalkr on the App Store
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Footer */}
        <Text style={styles.footer}>
          Stalkr — Real-time crew awareness
        </Text>
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: '100vh' as any,
    backgroundColor: '#0a0a0f',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 48,
    gap: 24,
  },
  // Subtle diagonal grid lines for tactical feel (pure CSS on web)
  gridOverlay: {
    ...StyleSheet.absoluteFill,
    opacity: 0.035,
    // @ts-expect-error web-only CSS property
    backgroundImage:
      'repeating-linear-gradient(0deg, #22c55e 0px, transparent 1px, transparent 40px), repeating-linear-gradient(90deg, #22c55e 0px, transparent 1px, transparent 40px)' as any,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  logoDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.9,
    shadowRadius: 6,
  },
  brandName: {
    color: '#e8e8f0',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 5,
  },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#12121a',
    borderRadius: 24,
    padding: 32,
    borderWidth: 1,
    borderColor: '#2a2a3a',
    alignItems: 'center',
    gap: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
  },
  // Radar animation rings
  radarWrap: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  radarOuter: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.2)',
  },
  radarInner: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
  },
  radarEmoji: {
    fontSize: 36,
  },
  eyebrow: {
    color: '#8888aa',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 3,
  },
  groupName: {
    color: '#22c55e',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  invalidTitle: {
    color: '#e8e8f0',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#1e1e2e',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  dotLive: {
    backgroundColor: '#22c55e',
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
  },
  statText: {
    color: '#c8c8e0',
    fontSize: 13,
    fontWeight: '500',
  },
  description: {
    color: '#8888aa',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  codeBox: {
    width: '100%',
    backgroundColor: '#0a0a0f',
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#22c55e',
    alignItems: 'center',
    gap: 4,
  },
  codeLabel: {
    color: '#8888aa',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2,
  },
  codeText: {
    color: '#22c55e',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: 5,
    fontFamily: 'monospace',
  },
  openBtn: {
    width: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 4,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
  },
  openBtnText: {
    color: '#000',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 1.5,
  },
  storeBtn: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2a2a3a',
  },
  storeBtnText: {
    color: '#8888aa',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  hint: {
    color: '#44445a',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
  },
  loadingText: {
    color: '#8888aa',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 8,
  },
  footer: {
    color: '#333350',
    fontSize: 12,
    letterSpacing: 0.5,
    marginTop: 8,
  },
});
