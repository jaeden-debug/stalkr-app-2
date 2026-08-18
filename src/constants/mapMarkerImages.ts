/**
 * Static marker artwork for the map's rotating overlays.
 *
 * These are plain images handed to the native SDK, NOT React views, so they are
 * never rasterised by react-native-maps and can never blank out (see
 * src/hooks/useMarkerSnapshot.ts for the failure class this avoids). Android
 * additionally shares one bitmap across every marker using the same source.
 *
 * Regenerate with:  npm run assets:markers
 * Source of truth:  scripts/generate-map-marker-assets.js
 */
import type { ImageRequireSource } from 'react-native';
import { CREW_COLORS, getCrewColorIndex } from './map';

/** Self-location puck variants. `require` paths must stay static for Metro. */
export const SELF_PUCK_IMAGE = {
  /** Broadcasting, compass available — directional arrow. */
  live: require('../../assets/map/self-puck.png') as ImageRequireSource,
  /**
   * Broadcasting, compass unavailable or untrusted — no arrow.
   * Rendering the directional variant at 0° would assert the user faces north.
   */
  noHeading: require('../../assets/map/self-puck-noheading.png') as ImageRequireSource,
  /** Go Dark — greyed and never directional. */
  dark: require('../../assets/map/self-puck-dark.png') as ImageRequireSource,
} as const;

/** One cone per crew colour, indexed to match CREW_COLORS. */
const CREW_CONE_IMAGES: readonly ImageRequireSource[] = [
  require('../../assets/map/crew-cone-0.png'),
  require('../../assets/map/crew-cone-1.png'),
  require('../../assets/map/crew-cone-2.png'),
  require('../../assets/map/crew-cone-3.png'),
  require('../../assets/map/crew-cone-4.png'),
  require('../../assets/map/crew-cone-5.png'),
  require('../../assets/map/crew-cone-6.png'),
  require('../../assets/map/crew-cone-7.png'),
  require('../../assets/map/crew-cone-8.png'),
  require('../../assets/map/crew-cone-9.png'),
];

if (__DEV__ && CREW_CONE_IMAGES.length !== CREW_COLORS.length) {
  console.warn(
    `[map] crew cone assets (${CREW_CONE_IMAGES.length}) do not match CREW_COLORS ` +
      `(${CREW_COLORS.length}). Run: npm run assets:markers`,
  );
}

/** Direction cone tinted to the same colour getCrewColor() assigns this user. */
export function getCrewConeImage(userId: string): ImageRequireSource {
  return CREW_CONE_IMAGES[getCrewColorIndex(userId)];
}
