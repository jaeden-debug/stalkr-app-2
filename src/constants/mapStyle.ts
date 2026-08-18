/**
 * Google Maps style overrides.
 *
 * STALKR's map is an operational surface: crew positions, zones, hazards,
 * markers. Google's default basemap layers restaurants, shops and transit stops
 * on top of that, which competes with the pins that actually matter and makes a
 * property boundary harder to read.
 *
 * So points of interest are OFF by default and toggleable in Map Layers.
 *
 * NOTE: customMapStyle only applies to PROVIDER_GOOGLE (both platforms since the
 * iOS provider switch) and only to the `standard` basemap — Google ignores it
 * for satellite/hybrid, where these labels come from the imagery tiles.
 */
import type { MapStyleElement } from 'react-native-maps';

/**
 * Hide business/POI clutter while keeping the things a navigator needs:
 * parks and natural features stay (useful terrain context), and roads,
 * boundaries and place names are untouched.
 */
export const HIDE_POI_STYLE: MapStyleElement[] = [
  // Businesses, shops, restaurants — the noisiest layer.
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.attraction', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.government', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.place_of_worship', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
  // Transit stops/stations add pins that look like our markers.
  { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  // Parks keep their fill (terrain context) but lose the icon pins.
  { featureType: 'poi.park', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
];

/** Empty array = Google's default styling, i.e. POIs visible. */
export const DEFAULT_MAP_STYLE: MapStyleElement[] = [];
