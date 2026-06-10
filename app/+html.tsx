/**
 * app/+html.tsx — Global HTML shell for all Expo Router web pages.
 * Injects favicons, PWA manifest, and default OG/Twitter meta tags.
 * Per-page overrides (invite, watch) use expo-router/head to override these.
 *
 * Docs: https://docs.expo.dev/router/reference/static-rendering/#root-html
 */
import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

const ORIGIN = 'https://stalkr.app';
const DEFAULT_OG_IMAGE = `${ORIGIN}/stalkr-app-social-preview-og-image.png`;
const DEFAULT_TITLE = 'Stalkr | Real-Time Location Awareness & Safety Tracking';
const DEFAULT_DESC  = 'Know where your people are. Real-time location awareness built for modern outdoor life.';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" style={{ height: '100%' }}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* ── Favicons ──────────────────────────────────────────────────── */}
        <link rel="icon" href="/assets/favicons/favicon.ico" sizes="any" />
        <link rel="icon" type="image/png" sizes="16x16"  href="/assets/favicons/favicon-16.png" />
        <link rel="icon" type="image/png" sizes="32x32"  href="/assets/favicons/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="96x96"  href="/assets/favicons/favicon-96.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicons/favicon-192.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/assets/favicons/apple-touch-icon.png" />
        <link rel="apple-touch-icon" sizes="120x120" href="/assets/favicons/favicon-120.png" />
        <link rel="apple-touch-icon" sizes="152x152" href="/assets/favicons/favicon-152.png" />
        <link rel="apple-touch-icon" sizes="167x167" href="/assets/favicons/favicon-167.png" />

        {/* ── PWA Manifest ──────────────────────────────────────────────── */}
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Stalkr" />
        <meta name="application-name" content="Stalkr" />
        <meta name="theme-color" content="#080808" />
        <meta name="msapplication-TileColor" content="#080808" />

        {/* ── Default SEO ───────────────────────────────────────────────── */}
        <title>{DEFAULT_TITLE}</title>
        <meta name="description" content={DEFAULT_DESC} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={ORIGIN} />

        {/* ── Open Graph (default — overridden per-page) ────────────────── */}
        <meta property="og:site_name"   content="Stalkr" />
        <meta property="og:type"        content="website" />
        <meta property="og:url"         content={ORIGIN} />
        <meta property="og:title"       content={DEFAULT_TITLE} />
        <meta property="og:description" content={DEFAULT_DESC} />
        <meta property="og:image"       content={DEFAULT_OG_IMAGE} />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt"   content="Stalkr — Know Where Your People Are." />

        {/* ── Twitter / X Card ──────────────────────────────────────────── */}
        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:site"        content="@stalkrapp" />
        <meta name="twitter:title"       content={DEFAULT_TITLE} />
        <meta name="twitter:description" content={DEFAULT_DESC} />
        <meta name="twitter:image"       content={DEFAULT_OG_IMAGE} />

        {/* ── Expo scroll reset ─────────────────────────────────────────── */}
        <ScrollViewStyleReset />

        {/* ── Base styles ───────────────────────────────────────────────── */}
        <style>{`
          html, body, #root { height: 100%; }
          body {
            margin: 0;
            padding: 0;
            background: #080808;
            -webkit-font-smoothing: antialiased;
          }
          * { box-sizing: border-box; }
        `}</style>
      </head>
      <body style={{ height: '100%' }}>{children}</body>
    </html>
  );
}
