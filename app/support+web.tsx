/**
 * Support — web route, resolves at https://stalkr.app/support
 * Apple requires a reachable support URL.
 */
import React from 'react';
import Head from 'expo-router/head';
import { LegalPage, P, H } from '@/components/legal/LegalPage';

export default function SupportPage() {
  return (
    <LegalPage title="Support" updated="June 10, 2026">
      <Head>
        <title>Support · Stalkr</title>
        <meta name="description" content="Get help with Stalkr." />
      </Head>

      <P>Need help with Stalkr? We're here.</P>

      <H>Contact us</H>
      <P>Email <a href="mailto:support@stalkr.app" style={{ color: '#4ADE80' }}>support@stalkr.app</a> and we'll get back to you. Include your account email and a description of the issue (and screenshots if relevant).</P>

      <H>Common topics</H>
      <P>• <b>Location not updating:</b> ensure location permission is set to "Always" and that you're broadcasting (not in Go Dark) for the crew you expect to see you.</P>
      <P>• <b>Not receiving notifications:</b> check notification permission and your global + per-crew notification settings.</P>
      <P>• <b>Delete your account:</b> Settings → Delete Account. This is permanent.</P>

      <H>Legal</H>
      <P>See our <a href="/terms" style={{ color: '#4ADE80' }}>Terms of Service</a> and <a href="/privacy" style={{ color: '#4ADE80' }}>Privacy Policy</a>.</P>
    </LegalPage>
  );
}
