/** Central app configuration — single place to update brand */
export const APP_CONFIG = {
  /** Display name shown in the UI */
  name: process.env.EXPO_PUBLIC_APP_NAME ?? 'Stalkr',
  /** App slug / URL scheme */
  slug: 'stalkr',
  /** Support email */
  supportEmail: 'navtrl@stillawakemedia.com',
  /** Privacy policy URL */
  privacyUrl: 'https://navtrl.com/privacy',
  /** Terms of service URL */
  termsUrl: 'https://navtrl.com/terms',
} as const;
