/**
 * MAP_Z — single source of truth for map visual ordering.
 *
 * Before this file, zIndex literals (10, 12, 20, 25, 30, 40, 49, 50, 100, 995,
 * 999) were scattered across seven components, so no one could tell whether a
 * new overlay would out-rank an existing one. Every map child now takes its
 * zIndex from here.
 *
 * IMPORTANT — two independent z-spaces
 * Google Maps draws ALL markers above ALL shape overlays, regardless of zIndex.
 * `zIndex` only orders siblings within the same space:
 *   • SHAPES  — Circle / Polygon / Polyline   (drawn first, always beneath)
 *   • MARKERS — Marker                        (drawn second, always on top)
 * So SHAPE.ZONE_FILL=10 and MARKER.FIELD=40 are not comparable numbers; a zone
 * fill can never cover a marker no matter what values are chosen. The two
 * groups below are numbered separately to keep that explicit.
 */

/** Shape overlays: Circle, Polygon, Polyline. Always beneath every marker. */
export const MAP_Z_SHAPE = {
  /** Zone fills + borders — the backdrop everything else sits on. */
  ZONE: 10,
  /** Breadcrumb trails, above zone fills so a trail through a zone stays legible. */
  TRAIL: 20,
  /** Self accuracy halo — above trails, below the journey/destination radius. */
  SELF_ACCURACY: 30,
  /** Destination + rally arrival radii. */
  DESTINATION: 40,
  RALLY_POINT: 42,
  /** Live measure line. */
  MEASURE_LINE: 60,
  /** In-progress zone drafts outrank everything — they are being edited now. */
  DRAFT_SHAPE: 80,
} as const;

/** Marker overlays. Always above every shape. */
export const MAP_Z_MARKER = {
  /** Zone name badges — lowest markers; they label the backdrop. */
  ZONE_LABEL: 10,
  ZONE_LABEL_SELECTED: 12,
  /** Journey destination flag / rally flag. */
  DESTINATION: 20,
  RALLY_POINT: 22,
  /** Shared tactical pins. */
  FIELD_MARKER: 40,
  FIELD_MARKER_SELECTED: 45,
  /** Crew: rotating direction cone sits under the upright initials badge. */
  CREW_DIRECTION: 50,
  CREW_BADGE: 52,
  /** Self puck outranks crew — you must always be able to find yourself. */
  SELF_PUCK: 70,
  /** Avatar pin shown only while self is selected; sits directly above the puck. */
  SELF_SELECTED: 75,
  /** Transient search result pin. */
  SEARCH_PIN: 80,
  /** Measure sequence dots. */
  MEASURE_POINT: 90,
  /** Draft vertices and drag handles — the active editing surface. */
  DRAFT_POINT: 100,
  DRAFT_HANDLE: 102,
  /** Anything mid-drag floats above all else so it is never lost under a peer. */
  DRAGGING: 120,
} as const;
