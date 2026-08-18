/**
 * Branded STALKR auth email.
 *
 * ── Why it looks like this ──────────────────────────────────────────────────
 * Email clients are not browsers. Outlook renders with Word's engine, Gmail
 * strips <style> in some contexts, and dark-mode clients invert colours
 * unpredictably. So this deliberately uses:
 *   • table layout, not flex/grid
 *   • inline styles on every element, not classes
 *   • explicit background colours on every cell, so a client that inverts does
 *     not leave dark text on a dark ground
 *   • a bulletproof VML-free button (padded <a>), which survives Outlook
 *   • no external images — the wordmark is text, so nothing breaks when a
 *     client blocks remote content by default
 *
 * The palette matches src/constants/theme.ts: near-black ground, #4ADE80
 * signal green.
 */

export type AuthEmailKind = 'signup' | 'magiclink' | 'recovery' | 'invite' | 'email_change';

const C = {
  bg: '#080808',
  panel: '#12161A',
  border: '#232B31',
  green: '#4ADE80',
  greenInk: '#04140A',
  text: '#FFFFFF',
  sub: 'rgba(255,255,255,0.62)',
  faint: 'rgba(255,255,255,0.38)',
} as const;

interface Copy {
  eyebrow: string;
  heading: string;
  body: string;
  cta: string;
  footnote: string;
}

const COPY: Record<AuthEmailKind, Copy> = {
  signup: {
    eyebrow: 'Confirm your account',
    heading: 'Welcome to STALKR',
    body: 'Confirm your email to finish setting up your account and start sharing your location with the people who need to know where you are.',
    cta: 'Confirm my email',
    footnote: "If you didn't create a STALKR account, you can ignore this email — nothing will happen.",
  },
  magiclink: {
    eyebrow: 'Sign in',
    heading: 'Your sign-in link',
    body: 'Tap below to sign in to STALKR. This link works once and expires shortly.',
    cta: 'Sign in to STALKR',
    footnote: "If you didn't ask to sign in, ignore this email and your account stays secure.",
  },
  recovery: {
    eyebrow: 'Password reset',
    heading: 'Reset your password',
    body: 'Tap below to choose a new password. This link works once and expires shortly.',
    cta: 'Choose a new password',
    footnote: "If you didn't request a reset, ignore this email — your current password still works.",
  },
  invite: {
    eyebrow: 'Invitation',
    heading: "You've been invited",
    body: 'Someone invited you to STALKR — real-time location awareness for the people you move with. Accept below to set up your account.',
    cta: 'Accept invitation',
    footnote: 'If this looks unfamiliar, you can safely ignore it.',
  },
  email_change: {
    eyebrow: 'Email change',
    heading: 'Confirm your new email',
    body: 'Confirm this address to finish moving your STALKR account to it.',
    cta: 'Confirm new email',
    footnote: "If you didn't request this change, ignore this email and contact support.",
  },
};

/** Minimal HTML escape — the code and URL are ours, but never assume. */
function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function renderAuthEmail(opts: {
  kind: AuthEmailKind;
  confirmUrl: string;
  code?: string;
}): string {
  const c = COPY[opts.kind];
  const url = esc(opts.confirmUrl);
  const code = opts.code ? esc(opts.code) : '';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark light">
<meta name="supported-color-schemes" content="dark light">
<title>STALKR</title>
</head>
<body style="margin:0;padding:0;background-color:${C.bg};">
  <!-- Preheader: shown in the inbox list, hidden in the body. -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${esc(c.body)}</div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:${C.bg};margin:0;padding:0;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:520px;width:100%;">

          <!-- Wordmark. Text, not an image, so a client blocking remote
               content still shows the brand. -->
          <tr>
            <td align="center" style="padding-bottom:26px;">
              <span style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                           font-size:24px;font-weight:800;letter-spacing:5px;
                           color:${C.text};">STALKR</span>
              <div style="height:3px;width:34px;background-color:${C.green};
                          margin:9px auto 0;border-radius:2px;"></div>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background-color:${C.panel};border:1px solid ${C.border};
                       border-radius:18px;padding:34px 32px;">

              <p style="margin:0 0 10px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                        font-size:11px;font-weight:700;letter-spacing:1.6px;
                        text-transform:uppercase;color:${C.green};">${esc(c.eyebrow)}</p>

              <h1 style="margin:0 0 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                         font-size:25px;line-height:1.25;font-weight:800;
                         color:${C.text};">${esc(c.heading)}</h1>

              <p style="margin:0 0 28px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                        font-size:15px;line-height:1.6;color:${C.sub};">${esc(c.body)}</p>

              <!-- CTA. A padded anchor rather than a styled button element:
                   button styling is unreliable across clients. -->
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding-bottom:26px;">
                    <a href="${url}"
                       style="display:inline-block;background-color:${C.green};
                              color:${C.greenInk};text-decoration:none;
                              font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                              font-size:15px;font-weight:800;letter-spacing:0.3px;
                              padding:15px 34px;border-radius:12px;">${esc(c.cta)}</a>
                  </td>
                </tr>
              </table>

              ${code ? `
              <!-- Code fallback for clients that rewrite or break links. -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="border-top:1px solid ${C.border};">
                <tr>
                  <td align="center" style="padding-top:22px;">
                    <p style="margin:0 0 8px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                              font-size:11px;font-weight:700;letter-spacing:1.2px;
                              text-transform:uppercase;color:${C.faint};">Or enter this code</p>
                    <p style="margin:0;font-family:'SF Mono',Menlo,Consolas,monospace;
                              font-size:27px;font-weight:700;letter-spacing:7px;
                              color:${C.text};">${code}</p>
                  </td>
                </tr>
              </table>` : ''}

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:22px 8px 0;">
              <p style="margin:0 0 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                        font-size:12.5px;line-height:1.6;color:${C.faint};">${esc(c.footnote)}</p>

              <p style="margin:0 0 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                        font-size:11.5px;line-height:1.6;color:${C.faint};">
                Button not working? Paste this into your browser:<br>
                <span style="color:${C.sub};word-break:break-all;">${url}</span>
              </p>

              <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;
                        font-size:11px;line-height:1.6;color:${C.faint};">
                STALKR · Know where your people are<br>
                This is an automated message — replies are not monitored.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
