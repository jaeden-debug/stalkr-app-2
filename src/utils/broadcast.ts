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

export interface BroadcastScope {
  /**
   * True when the crew's tracking_mode is 'enforced'.
   *
   * Enforcement is a CREW policy and outranks the member's personal choice —
   * useGoDark already refuses to toggle in an enforced crew, so honouring it
   * here keeps the gate and the toggle telling the same story.
   */
  enforced?: boolean;
}

/**
 * @param statusMap useLocationStore.groupBroadcastingStatus
 * @param groupId   crew to test
 * @param scope     crew policy for this crew
 *
 * DEFAULT IS DARK. An absent entry means "this member has never opted in", and
 * an un-opted-in member does not broadcast.
 *
 * This is a deliberate change of the product's privacy posture, made on an
 * explicit product decision. It previously defaulted to BROADCASTING, so
 * joining a crew started sharing location immediately with no affirmative act.
 *
 * MIGRATION NOTE: groupBroadcastingStatus is persisted per device via
 * AsyncStorage. Existing users who never toggled have no entry, so they become
 * dark on next launch until they opt in. That is the intended direction (fail
 * closed), but it is a visible behaviour change for current users and wants an
 * onboarding prompt on first crew open.
 */
export function isBroadcastingToCrew(
  statusMap: Record<string, boolean>,
  groupId: string | null | undefined,
  scope: BroadcastScope = {},
): boolean {
  if (!groupId) return false;
  // Crew-enforced tracking wins over both the default and a personal opt-out.
  if (scope.enforced) return true;
  const explicit = statusMap[groupId];
  return explicit === true;
}

/** Inverse of the above, for surfaces that talk in terms of darkness. */
export function isDarkForCrew(
  statusMap: Record<string, boolean>,
  groupId: string | null | undefined,
  scope: BroadcastScope = {},
): boolean {
  return !isBroadcastingToCrew(statusMap, groupId, scope);
}
