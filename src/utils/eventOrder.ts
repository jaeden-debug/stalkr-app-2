/**
 * Event ordering for realtime updates.
 *
 * Network arrival order is not causal order. Supabase realtime, retries, and a
 * Wi-Fi→cellular handover can all deliver an older location AFTER a newer one.
 * Applied naively — "last write wins by arrival" — a crew marker jumps
 * backwards to where the person was thirty seconds ago, and a Go Dark
 * transition can be undone by a stale live ping that was still in flight.
 *
 * Ordering is therefore decided by the SERVER-assigned timestamp on the row,
 * never by when the packet reached us.
 */

/** Row shape we can order. Both fields are server-set. */
export interface OrderableLocation {
  updated_at?: string | null;
  last_ping_at?: string | null;
}

/**
 * Best available event time in ms, or null when the row carries none.
 *
 * `updated_at` is preferred: it changes on every write including a status-only
 * change (going dark writes status without moving), whereas `last_ping_at`
 * tracks position freshness specifically.
 */
export function eventTimeMs(row: OrderableLocation | null | undefined): number | null {
  if (!row) return null;
  for (const value of [row.updated_at, row.last_ping_at]) {
    if (!value) continue;
    const parsed = new Date(value).getTime();
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * True when `incoming` is older than what we already hold and must be dropped.
 *
 * Rules, in order:
 *  • No existing row              → accept (nothing to be older than).
 *  • Incoming has no timestamp    → accept ONLY if the existing one has none
 *                                   either; otherwise an untimestamped row
 *                                   cannot be proven newer, so it is dropped
 *                                   rather than allowed to clobber a known-good
 *                                   position.
 *  • Existing has no timestamp    → accept (any dated row beats an undated one).
 *  • Strictly older               → reject.
 *  • Equal                        → accept. Two writes can share a timestamp at
 *                                   the same clock resolution, and the second
 *                                   commonly carries a status change such as
 *                                   going dark. Rejecting equal timestamps
 *                                   would strand that transition.
 */
export function isStaleUpdate(
  existing: OrderableLocation | null | undefined,
  incoming: OrderableLocation | null | undefined,
): boolean {
  if (!existing) return false;

  const existingMs = eventTimeMs(existing);
  const incomingMs = eventTimeMs(incoming);

  if (existingMs === null) return false;
  if (incomingMs === null) return true;

  return incomingMs < existingMs;
}
