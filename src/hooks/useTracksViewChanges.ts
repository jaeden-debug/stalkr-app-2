/**
 * useTracksViewChanges — fixes the classic react-native-maps bug where a custom
 * <Marker> with tracksViewChanges={false} set on first mount renders a blank /
 * zero-size snapshot (invisible marker, dead tap target).
 *
 * Returns `true` for a short window after mount and whenever the supplied deps
 * change, then settles back to `false` so the marker stops re-rendering every
 * frame (which is what kills map performance). Pass the visual inputs that
 * should force a re-snapshot (coords, heading, selected/dragging flags…).
 *
 * If `force` is true (e.g. while actively dragging) it stays `true` until the
 * drag ends.
 */
import { useEffect, useState } from 'react';

export function useTracksViewChanges(deps: ReadonlyArray<unknown>, force = false): boolean {
  const [tracks, setTracks] = useState(true);

  useEffect(() => {
    if (force) {
      setTracks(true);
      return;
    }
    setTracks(true);
    const t = setTimeout(() => setTracks(false), 700);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, force]);

  return tracks || force;
}
