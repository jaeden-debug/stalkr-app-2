/**
 * /watch/[token] — Public web-only live viewer.
 * No auth required. Uses Supabase Realtime broadcast to receive location updates
 * from the traveler's device via useLocationTracker.
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import Head from 'expo-router/head';
import { useLocalSearchParams } from 'expo-router';
import { supabase } from '@/services/supabase';
import { addEmailWatcher } from '@/services/sessions';

const ORIGIN = 'https://stalkr.app';
const OG_IMAGE = `${ORIGIN}/assets/og-image.jpg`;

// ─── Google Maps global (loaded dynamically) ─────────────────────────────────
declare const google: any; // eslint-disable-line no-var

// ─── Types ────────────────────────────────────────────────────────────────────

interface SessionInfo {
  id: string;
  name: string;
  traveler_name: string | null;
  destination_name: string | null;
  destination_latitude: number | null;
  destination_longitude: number | null;
  status: 'active' | 'arrived' | 'cancelled';
  is_active: boolean;
  watch_token: string;
}

interface LivePayload {
  latitude: number;
  longitude: number;
  heading: number;
  updatedAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function WatchPage() {
  const { token } = useLocalSearchParams<{ token: string }>();

  const [session, setSession] = useState<SessionInfo | null>(null);
  const [live, setLive] = useState<LivePayload | null>(null);
  const [arrived, setArrived] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const destMarkerRef = useRef<any>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // ── Load session from DB via RPC ──────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    (async () => {
      const { data, error } = await supabase.rpc('get_session_by_watch_token', {
        p_token: token,
      });
      if (error || !data || data.length === 0) {
        setNotFound(true);
        return;
      }
      const s = data[0] as SessionInfo;
      setSession(s);
      if (s.status === 'arrived' || !s.is_active) {
        setArrived(true);
      }
    })();
  }, [token]);

  // ── Subscribe to Realtime broadcast ──────────────────────────────────────
  useEffect(() => {
    if (!token || arrived) return;

    const ch = supabase.channel(`session:${token}`)
      .on('broadcast', { event: 'location' }, ({ payload }) => {
        setLive(payload as LivePayload);
      })
      .on('broadcast', { event: 'arrived' }, () => {
        setArrived(true);
      })
      .subscribe();

    channelRef.current = ch;
    return () => {
      supabase.removeChannel(ch);
    };
  }, [token, arrived]);

  // ── Init Google Maps ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!session || typeof window === 'undefined') return;
    // Load Google Maps JS API lazily (key via env)
    const GMAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY ?? '';
    if (!document.querySelector('#gmaps-script')) {
      const script = document.createElement('script');
      script.id = 'gmaps-script';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&callback=__gmapsReady`;
      script.async = true;
      document.head.appendChild(script);
    }

    (window as any).__gmapsReady = () => {
      const mapEl = document.getElementById('watch-map');
      if (!mapEl) return;
      const defaultCenter = session.destination_latitude
        ? { lat: session.destination_latitude, lng: session.destination_longitude! }
        : { lat: 0, lng: 0 };

      const map = new google.maps.Map(mapEl, {
        center: defaultCenter,
        zoom: 15,
        mapTypeId: 'roadmap',
        disableDefaultUI: false,
        zoomControl: true,
      });
      mapRef.current = map;

      // Destination pin
      if (session.destination_latitude && session.destination_longitude) {
        destMarkerRef.current = new google.maps.Marker({
          position: { lat: session.destination_latitude, lng: session.destination_longitude! },
          map,
          title: session.destination_name ?? 'Destination',
          icon: {
            url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png',
          },
        });
      }
    };

    // If already loaded
    if ((window as any).google?.maps) {
      (window as any).__gmapsReady();
    }
  }, [session]);

  // ── Update traveler marker on new location ────────────────────────────────
  useEffect(() => {
    if (!live || !mapRef.current) return;
    const pos = { lat: live.latitude, lng: live.longitude };
    if (!markerRef.current) {
      markerRef.current = new google.maps.Marker({
        position: pos,
        map: mapRef.current,
        title: session?.traveler_name ?? 'Traveler',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#22c55e',
          fillOpacity: 1,
          strokeColor: '#fff',
          strokeWeight: 2,
        },
      });
    } else {
      markerRef.current.setPosition(pos);
    }
    mapRef.current.panTo(pos);
  }, [live]);

  // ── Email opt-in ──────────────────────────────────────────────────────────
  const handleEmailSubmit = useCallback(async () => {
    if (!session || !email.trim()) return;
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email.trim())) {
      setEmailError('Please enter a valid email address.');
      return;
    }
    setEmailLoading(true);
    setEmailError('');
    try {
      await addEmailWatcher(session.id, email.trim());
      setEmailSent(true);
    } catch {
      setEmailError('Something went wrong. Try again.');
    } finally {
      setEmailLoading(false);
    }
  }, [session, email]);

  // ── Render ────────────────────────────────────────────────────────────────
  if (notFound) {
    return (
      <div style={styles.center}>
        <h2 style={styles.title}>Session not found</h2>
        <p style={styles.sub}>This link may have expired or the journey has ended.</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div style={styles.center}>
        <div style={styles.spinner} />
        <p style={styles.sub}>Loading journey…</p>
      </div>
    );
  }

  if (arrived) {
    return (
      <div style={styles.center}>
        <div style={{ fontSize: 64 }}>✅</div>
        <h2 style={styles.title}>
          {session.traveler_name ?? 'Your contact'} arrived safely
        </h2>
        {session.destination_name && (
          <p style={styles.sub}>at {session.destination_name}</p>
        )}
      </div>
    );
  }

  const traveler = session.traveler_name ?? 'Someone';
  const dest     = session.destination_name;
  const pageTitle = dest
    ? `${traveler} is heading to ${dest} — Stalkr`
    : `${traveler}'s live journey — Stalkr`;
  const pageDesc = dest
    ? `Follow ${traveler}'s live location on their way to ${dest}. Get notified when they arrive safely.`
    : `Follow ${traveler}'s live location in real time. Get notified when they arrive safely.`;

  return (
    <div style={styles.page}>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDesc} />
        <meta name="robots" content="noindex" />
        <meta name="theme-color" content="#080808" />

        <meta property="og:type"         content="website" />
        <meta property="og:url"          content={`${ORIGIN}/watch/${token}`} />
        <meta property="og:title"        content={pageTitle} />
        <meta property="og:description"  content={pageDesc} />
        <meta property="og:image"        content={OG_IMAGE} />
        <meta property="og:image:type"   content="image/jpeg" />
        <meta property="og:image:width"  content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:site_name"    content="Stalkr" />

        <meta name="twitter:card"        content="summary_large_image" />
        <meta name="twitter:site"        content="@stalkrapp" />
        <meta name="twitter:title"       content={pageTitle} />
        <meta name="twitter:description" content={pageDesc} />
        <meta name="twitter:image"       content={OG_IMAGE} />
      </Head>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.dot} />
        <div>
          <p style={styles.headerTitle}>
            {session.traveler_name ?? 'Someone'} is on their way
          </p>
          {session.destination_name && (
            <p style={styles.headerSub}>→ {session.destination_name}</p>
          )}
        </div>
      </div>

      {/* Map */}
      <div id="watch-map" style={styles.map} />

      {/* Last update */}
      {live && (
        <p style={styles.lastUpdate}>
          Last updated {formatTime(live.updatedAt)}
        </p>
      )}
      {!live && (
        <p style={styles.lastUpdate}>Waiting for location…</p>
      )}

      {/* Email opt-in */}
      <div style={styles.emailCard}>
        {emailSent ? (
          <p style={styles.emailSuccess}>
            ✅ We'll email you when they arrive.
          </p>
        ) : (
          <>
            <p style={styles.emailLabel}>Get notified when they arrive</p>
            <div style={styles.emailRow}>
              <input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleEmailSubmit()}
                style={styles.input}
              />
              <button
                onClick={handleEmailSubmit}
                disabled={emailLoading}
                style={styles.button}
              >
                {emailLoading ? '…' : 'Notify me'}
              </button>
            </div>
            {emailError && <p style={styles.emailError}>{emailError}</p>}
          </>
        )}
      </div>

      <p style={styles.footer}>Powered by Stalkr</p>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  page: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: '#0f1117',
    color: '#fff',
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    background: '#0f1117',
    color: '#fff',
    gap: 12,
    padding: 24,
    textAlign: 'center',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 20px',
    background: '#1a1d26',
    borderBottom: '1px solid #2a2d3a',
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#22c55e',
    flexShrink: 0,
    boxShadow: '0 0 8px #22c55e',
  },
  headerTitle: {
    margin: 0,
    fontWeight: 600,
    fontSize: 15,
    color: '#fff',
  },
  headerSub: {
    margin: 0,
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 2,
  },
  map: {
    flex: 1,
    minHeight: 0,
  },
  lastUpdate: {
    margin: 0,
    padding: '6px 16px',
    fontSize: 12,
    color: '#6b7280',
    background: '#1a1d26',
    textAlign: 'center',
  },
  emailCard: {
    padding: '16px 20px',
    background: '#1a1d26',
    borderTop: '1px solid #2a2d3a',
  },
  emailLabel: {
    margin: '0 0 10px',
    fontSize: 13,
    color: '#d1d5db',
    fontWeight: 500,
  },
  emailRow: {
    display: 'flex',
    gap: 8,
  },
  input: {
    flex: 1,
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid #374151',
    background: '#111827',
    color: '#fff',
    fontSize: 14,
    outline: 'none',
  },
  button: {
    padding: '9px 16px',
    borderRadius: 8,
    border: 'none',
    background: '#22c55e',
    color: '#fff',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  emailSuccess: {
    margin: 0,
    color: '#22c55e',
    fontSize: 14,
    fontWeight: 500,
  },
  emailError: {
    margin: '6px 0 0',
    color: '#ef4444',
    fontSize: 12,
  },
  footer: {
    textAlign: 'center',
    padding: '8px',
    fontSize: 11,
    color: '#4b5563',
    background: '#0f1117',
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 700,
  },
  sub: {
    margin: 0,
    color: '#9ca3af',
    fontSize: 14,
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #374151',
    borderTop: '3px solid #22c55e',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
};
