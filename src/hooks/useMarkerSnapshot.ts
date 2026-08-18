/**
 * useMarkerSnapshot — deterministic replacement for the fixed-timeout
 * `useTracksViewChanges`.
 *
 * ── The bug this removes ──────────────────────────────────────────────────
 * A react-native-maps <Marker> with React children is rasterised to a bitmap.
 * `tracksViewChanges` controls whether that bitmap is refreshed. The old hook
 * held it true for a fixed 700 ms after mount / dep change, then set it false.
 * That is a race against native layout, and losing it is unrecoverable:
 *
 *   MapMarker.java:665 createDrawable()
 *     int width = this.width <= 0 ? 100 : this.width;   // view not measured yet
 *     bitmap.eraseColor(TRANSPARENT); this.draw(canvas); // draws nothing
 *
 *   MapMarker.java:317 updateTracksViewChanges()
 *     boolean shouldTrack = tracksViewChanges && hasCustomMarkerView && ...;
 *     if (shouldTrack == tracksViewChangesActive) return;   // <-- early return
 *
 *   MapMarker.java:539 requestLayout()
 *     if (updated == 0) { updated = 1; updateTracksViewChanges(); }  // no-ops
 *
 * So if the 700 ms timer fired before the view had been measured, the marker
 * was frozen on a fully transparent bitmap, and because tracking was now off
 * nothing would ever redraw it. That is the "markers disappear after another
 * marker is created" report: creating a marker floods the JS thread exactly
 * when the timer is counting down.
 *
 * ── The fix ──────────────────────────────────────────────────────────────
 * Stop guessing when layout finished; let the view tell us. `tracksViewChanges`
 * stays true until onLayout reports a non-zero measured size, then goes false.
 *
 * The failure direction is now inverted, which is the important property:
 *   old — timer wins the race  → marker is INVISIBLE, permanently.
 *   new — onLayout never fires → marker keeps rasterising, stays VISIBLE.
 * A performance cost is recoverable; an invisible marker is not.
 *
 * ── Why not just leave tracksViewChanges permanently true? ────────────────
 * It is nearly free on Android — ViewChangesTracker.java runs a 40 ms loop only
 * while markers are registered, and updateCustomForTracking() deregisters a
 * marker once `updated == 0`, stopping the loop entirely when idle. But it is
 * NOT free on iOS: AIRGoogleMapMarker.m:96 forwards straight to
 * GMSMarker.tracksViewChanges, a genuine per-frame redraw with no self-limiting.
 * Now that iOS renders Google Maps too, always-on would be a real cost there.
 */
import { useCallback, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';

export interface MarkerSnapshot {
  /** Pass to <Marker tracksViewChanges={...}>. */
  tracksViewChanges: boolean;
  /** Pass to the marker's ROOT child <View onLayout={...}>. Required. */
  onLayout: (event: LayoutChangeEvent) => void;
}

/**
 * @param resetKeys Visual inputs that change the marker's appearance (selected
 *   state, label text, colour…). When one changes, the marker re-rasterises and
 *   re-settles. Keep this list minimal — coordinates do NOT belong here, since
 *   moving a marker does not change its bitmap.
 * @param force Hold rasterisation on regardless — used while a marker is being
 *   dragged, when its appearance changes every frame.
 */
export function useMarkerSnapshot(
  resetKeys: readonly unknown[] = [],
  force = false,
): MarkerSnapshot {
  const [laidOut, setLaidOut] = useState(false);

  // Derive the reset during render rather than in an effect. An effect would
  // leave one committed frame where the marker shows its OLD bitmap against its
  // NEW props — visible as a flicker when selecting a pin.
  const serialized = JSON.stringify(resetKeys);
  const previous = useRef(serialized);
  if (previous.current !== serialized) {
    previous.current = serialized;
    if (laidOut) setLaidOut(false);
  }

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    // Zero-size means the view has not really been measured yet. Settling here
    // is exactly the bug above, so we wait for a real measurement.
    if (width > 0 && height > 0) setLaidOut(true);
  }, []);

  return { tracksViewChanges: force || !laidOut, onLayout };
}
