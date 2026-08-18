/**
 * Notification tap routing.
 *
 * Nothing in this app listened for a notification tap at all before this: every
 * push, including SOS, opened the app on whatever screen you last left. The
 * notification announced something urgent and then dropped you somewhere
 * unrelated.
 *
 * The rule these tests pin: a tap lands you where you can ACT on the thing.
 */
import { routeForNotification } from '@/services/notificationRouter';

describe('emergencies', () => {
  it('sends an SOS tap to the map, focused on the reported position', () => {
    // Every extra tap here is spent while someone is waiting.
    expect(routeForNotification({ type: 'sos', latitude: 45.1, longitude: -75.2 })).toEqual({
      pathname: '/(tabs)/map',
      params: { focus: 'sos', lat: '45.1', lng: '-75.2' },
    });
  });

  it('still routes an SOS that carries no position', () => {
    // An SOS raised with no GPS fix is the case where help is most needed.
    expect(routeForNotification({ type: 'sos' })).toEqual({
      pathname: '/(tabs)/map',
      params: { focus: 'sos' },
    });
  });

  it('ignores unusable coordinates rather than passing them on', () => {
    const r = routeForNotification({ type: 'sos', latitude: NaN, longitude: -75 });
    expect(r?.params).toEqual({ focus: 'sos' });
  });

  it('routes an SOS cancellation too', () => {
    expect(routeForNotification({ type: 'sos_cancel' })?.params).toEqual({ focus: 'sos_cancel' });
  });
});

describe('journeys', () => {
  it('lands the overdue nudge where the traveller can answer it', () => {
    // This is the one push with a deadline on answering: not responding gets
    // your emergency contacts alarmed.
    expect(routeForNotification({ type: 'journey_overdue_nudge', sessionId: 's1' })).toEqual({
      pathname: '/(tabs)/map',
      params: { focus: 'journey_overdue' },
    });
  });

  it('takes a watcher from an overdue alert to that journey', () => {
    expect(routeForNotification({ type: 'journey_overdue_alert', sessionId: 's1' })).toEqual({
      pathname: '/(tabs)/sessions',
      params: { focus: 'journey_overdue', sessionId: 's1' },
    });
  });

  it.each(['arrival', 'session_arrived', 'session_ended'])('routes %s to the journey', (type) => {
    expect(routeForNotification({ type, sessionId: 's9' })).toEqual({
      pathname: '/(tabs)/sessions',
      params: { sessionId: 's9' },
    });
  });
});

describe('check-ins', () => {
  it.each(['checkin_due', 'checkin_missed'])('%s lands where you confirm you are fine', (type) => {
    expect(routeForNotification({ type })?.params).toEqual({ focus: 'checkin' });
  });

  it('does not focus anything for a confirmation', () => {
    // Nothing is being asked of the user, so nothing should be highlighted.
    expect(routeForNotification({ type: 'checkin_confirmed' })).toEqual({ pathname: '/(tabs)/map' });
  });
});

describe('zones and markers', () => {
  it('carries the zone through so the map can focus it', () => {
    expect(routeForNotification({ type: 'zone_crew', zoneId: 'z1' })).toEqual({
      pathname: '/(tabs)/map',
      params: { zoneId: 'z1' },
    });
  });

  it('carries a marker arrival through', () => {
    expect(routeForNotification({ type: 'zone_crew', markerId: 'm1' })?.params).toEqual({
      markerId: 'm1',
    });
  });

  it.each(['camp', 'vehicle', 'waypoint', 'danger', 'safe_zone', 'circle', 'polygon'])(
    'routes the %s marker type to the map',
    (type) => {
      expect(routeForNotification({ type })?.pathname).toBe('/(tabs)/map');
    },
  );
});

describe('refusing to guess', () => {
  it('returns nothing for a generic notice with no subject', () => {
    // Opening the app IS the whole response. Inventing a destination would
    // just confuse someone who tapped an informational message.
    expect(routeForNotification({ type: 'general' })).toBeNull();
  });

  it('routes a general notice that does name a journey', () => {
    // Journey invites ride on 'general' and do carry a session.
    expect(routeForNotification({ type: 'general', sessionId: 's1' })).toEqual({
      pathname: '/(tabs)/sessions',
      params: { sessionId: 's1' },
    });
  });

  it('survives malformed and hostile payloads without throwing', () => {
    // Payloads arrive from the network; a bad one must not crash the launch
    // path of the entire app.
    expect(routeForNotification(null)).toBeNull();
    expect(routeForNotification(undefined)).toBeNull();
    expect(routeForNotification({})).toBeNull();
    expect(routeForNotification({ type: 42 as never })).toBeNull();
    expect(routeForNotification({ type: 'not_a_real_type' })).toBeNull();
    expect(() => routeForNotification({ type: 'sos', latitude: 'x' as never })).not.toThrow();
  });

  it('does not pass through a session id of the wrong type', () => {
    expect(routeForNotification({ type: 'arrival', sessionId: 99 as never })?.params).toBeUndefined();
  });
});
