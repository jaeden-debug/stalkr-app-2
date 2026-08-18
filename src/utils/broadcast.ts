/**
 * The single expression that decides whether we are sharing location with a
 * crew. PRIVACY-CRITICAL — every surface must use this, never its own copy.
 *
 * ── Why one function ────────────────────────────────────────────────────────
 * Broadcasting was gated in useLocationTracker by
 *     groupBroadcastingStatus[groupId] !== false
 * while the self drawer toggled the separate GLOBAL useLocationStore
 * .isBroadcasting flag, and SelfMarker greyed itself out using
 *     perCrew !== undefined ? !perCrew : !isBroadcasting
 *
 * Those three expressions disagreed. With the per-crew flag unset and the
 * global flag false, the marker rendered DARK while the tracker kept
 * broadcasting to every crew — the user believed they were hidden and was not.
 *
 * Deriving the UI from the same call the tracker makes removes the class of
 * bug rather than one instance of it: there is nothing left to keep in sync.
 */

/**
 * @param statusMap useLocationStore.groupBroadcastingStatus
 * @param groupId   crew to test
 *
 * NOTE the default: an ABSENT entry means broadcasting. That is the tracker's
 * existing behaviour and is preserved here deliberately rather than silently
 * changed — flipping it would alter the product's default privacy posture.
 */
export function isBroadcastingToCrew(
  statusMap: Record<string, boolean>,
  groupId: string | null | undefined,
): boolean {
  if (!groupId) return false;
  return statusMap[groupId] !== false;
}

/** Inverse of the above, for surfaces that talk in terms of darkness. */
export function isDarkForCrew(
  statusMap: Record<string, boolean>,
  groupId: string | null | undefined,
): boolean {
  return !isBroadcastingToCrew(statusMap, groupId);
}
