/**
 * Privacy Policy — web route, resolves at https://stalkr.app/privacy
 * Required by the App Store. NOTE: this is a thorough template written for
 * Stalkr's data model; have it reviewed by counsel before launch.
 */
import React from 'react';
import Head from 'expo-router/head';
import { LegalPage, P, H, LI } from '@/components/legal/LegalPage';

const UPDATED = 'June 10, 2026';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" updated={UPDATED}>
      <Head>
        <title>Privacy Policy · Stalkr</title>
        <meta name="description" content="How Stalkr collects, uses, and protects your data." />
      </Head>

      <P>Stalkr ("we," "us") provides real-time location awareness and safety tools. This policy explains what we collect, how we use it, and the choices you have. By using Stalkr you agree to this policy.</P>

      <H>Information we collect</H>
      <LI><b>Account:</b> email, display name, call sign, initials, optional phone number, and profile photo.</LI>
      <LI><b>Location:</b> precise GPS (latitude, longitude, heading, speed, accuracy) and battery level while you are sharing with a crew or running a journey. You control sharing per crew and can "go dark" at any time.</LI>
      <LI><b>Crews & content:</b> crews you create or join, markers, zones, trails, journeys, and activity events.</LI>
      <LI><b>Contacts:</b> if you choose to add emergency contacts, the names and phone numbers you select. We do not upload your full address book.</LI>
      <LI><b>Device:</b> push notification tokens and basic diagnostics for reliability and crash reporting.</LI>

      <H>How we use it</H>
      <LI>To show your position to crews you have chosen to share with, and to power zones, journeys, trails, and arrival/SOS alerts.</LI>
      <LI>To send notifications you have enabled.</LI>
      <LI>To operate, secure, and improve the service.</LI>
      <P>We do <b>not</b> sell your personal information, and we do not show third-party ads.</P>

      <H>Sharing</H>
      <P>Your location is shared only with crews you join and with watchers of journeys you start. Public journey "watch" links show your live position to anyone who has the link until the journey ends. Service providers process data on our behalf: Supabase (database, auth, storage), Expo (push delivery), and Google Maps (map rendering and place search).</P>

      <H>Retention & deletion</H>
      <P>We keep your data while your account is active. You can permanently delete your account at any time from <b>Settings → Delete Account</b>. Deletion removes your profile, crews you own, journeys, locations, markers, zones, and associated records. This is irreversible.</P>

      <H>Your choices</H>
      <LI>Control location sharing per crew and "go dark" instantly.</LI>
      <LI>Manage notification preferences globally and per crew.</LI>
      <LI>Revoke location, contacts, photo, and notification permissions in your device settings.</LI>

      <H>Children</H>
      <P>Stalkr is not directed to children under 13, and we do not knowingly collect their data.</P>

      <H>Contact</H>
      <P>Questions or requests: <a href="mailto:support@stalkr.app" style={{ color: '#4ADE80' }}>support@stalkr.app</a>.</P>
    </LegalPage>
  );
}
