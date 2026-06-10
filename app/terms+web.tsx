/**
 * Terms of Service — web route, resolves at https://stalkr.app/terms
 * Template tailored to Stalkr; have counsel review before launch.
 */
import React from 'react';
import Head from 'expo-router/head';
import { LegalPage, P, H, LI } from '@/components/legal/LegalPage';

const UPDATED = 'June 10, 2026';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" updated={UPDATED}>
      <Head>
        <title>Terms of Service · Stalkr</title>
        <meta name="description" content="The terms that govern your use of Stalkr." />
      </Head>

      <P>These Terms govern your use of Stalkr. By creating an account or using the app, you agree to them. If you do not agree, do not use Stalkr.</P>

      <H>The service</H>
      <P>Stalkr provides real-time location sharing, crews, zones, journeys, and safety alerts. Location and connectivity features depend on your device, GPS, cellular/Wi-Fi coverage, and third-party services, and may be delayed, inaccurate, or unavailable.</P>

      <H>Not an emergency service</H>
      <P><b>Stalkr is not a substitute for emergency services.</b> SOS, check-ins, journeys, and alerts are convenience features and may fail. In an emergency, always contact local emergency services (e.g., 911) directly. Do not rely on Stalkr as your sole safety system.</P>

      <H>Your responsibilities</H>
      <LI>Provide accurate information and keep your account secure.</LI>
      <LI>Only share the location of people who have consented, and only join crews you are invited to.</LI>
      <LI>Do not use Stalkr to stalk, harass, surveil without consent, or for any unlawful purpose.</LI>
      <LI>You are responsible for content you create (markers, names, photos, messages).</LI>

      <H>Subscriptions</H>
      <P>Some features may require a paid subscription billed through the App Store or Google Play. Subscriptions renew automatically unless cancelled in your store account at least 24 hours before the period ends. Manage or cancel through your store account.</P>

      <H>Account deletion</H>
      <P>You may delete your account at any time from Settings → Delete Account. Deletion is permanent and removes your data as described in the Privacy Policy.</P>

      <H>Disclaimers & liability</H>
      <P>Stalkr is provided "as is" without warranties of any kind. To the maximum extent permitted by law, we are not liable for any indirect, incidental, or consequential damages, or for any loss arising from reliance on location data or safety features.</P>

      <H>Changes</H>
      <P>We may update these Terms; continued use after changes means you accept them.</P>

      <H>Contact</H>
      <P>Questions: <a href="mailto:support@stalkr.app" style={{ color: '#4ADE80' }}>support@stalkr.app</a>.</P>
    </LegalPage>
  );
}
