/**
 * useAnalytics — thin hook that re-exports the analytics service functions
 * so components don't need to import from the service directly.
 *
 * Usage:
 *   const { track, screen } = useAnalytics();
 *   track({ name: 'marker_placed', properties: { marker_type: 'waypoint' } });
 */
import { useCallback } from 'react';
import { track as _track, screen as _screen, type AnalyticsEvent } from '@/services/analytics';

export function useAnalytics() {
  const track = useCallback((event: AnalyticsEvent) => {
    _track(event);
  }, []);

  const screen = useCallback((name: string, properties?: Record<string, unknown>) => {
    _screen(name, properties);
  }, []);

  return { track, screen };
}
