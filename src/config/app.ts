/** Central app configuration — single place to update brand */
export const APP_CONFIG = {
  /** Display name shown in the UI */
  name: process.env.EXPO_PUBLIC_APP_NAME ?? 'Stalkr',
  /** App slug / URL scheme */
  slug: 'stalkr',
  /** Support email */
  supportEmail: 'support@stalkr.app',
  /** Privacy policy URL */
  privacyUrl: 'https://stalkr.app/privacy',
  /** Terms of service URL */
  termsUrl: 'https://stalkr.app/terms',
} as const;
