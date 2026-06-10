/**
 * LegalPage — shared web layout for legal/support routes (privacy, terms,
 * support). Plain HTML so it server-renders cleanly and is crawlable.
 */
import React from 'react';

export const P: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: '0 0 14px', lineHeight: 1.65, color: '#c7c7d2', fontSize: 15 }}>{children}</p>
);

export const H: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <h2 style={{ margin: '26px 0 10px', fontSize: 18, fontWeight: 800, color: '#ffffff' }}>{children}</h2>
);

export const LI: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p style={{ margin: '0 0 8px 0', paddingLeft: 16, position: 'relative', lineHeight: 1.6, color: '#c7c7d2', fontSize: 15 }}>
    <span style={{ position: 'absolute', left: 0, color: '#4ADE80' }}>•</span>
    {children}
  </p>
);

export const LegalPage: React.FC<{ title: string; updated: string; children: React.ReactNode }> = ({
  title, updated, children,
}) => (
  <div style={{ minHeight: '100vh', background: '#080808', color: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 22px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
        <div style={{ width: 10, height: 10, borderRadius: 5, background: '#4ADE80', boxShadow: '0 0 8px #4ADE80' }} />
        <a href="/" style={{ color: '#e8e8f0', fontWeight: 900, letterSpacing: 4, fontSize: 13, textDecoration: 'none' }}>STALKR</a>
      </div>
      <h1 style={{ fontSize: 30, fontWeight: 900, margin: '0 0 6px' }}>{title}</h1>
      <p style={{ color: '#7a7a8c', fontSize: 13, margin: '0 0 28px' }}>Last updated {updated}</p>
      {children}
      <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid #222', color: '#55556a', fontSize: 12 }}>
        © {new Date().getFullYear()} Stalkr. <a href="/terms" style={{ color: '#4ADE80' }}>Terms</a> · <a href="/privacy" style={{ color: '#4ADE80' }}>Privacy</a> · <a href="/support" style={{ color: '#4ADE80' }}>Support</a>
      </div>
    </div>
  </div>
);
