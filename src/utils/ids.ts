/**
 * Local identity for ephemeral client-side entities (draft vertices, measure
 * points) that never reach the database.
 *
 * These lists were previously keyed by array index (`key={`draft-${idx}`}`).
 * Index keys are reused when the list mutates, so undoing a polygon vertex and
 * adding a new one handed React the same key for a different point — the stale
 * marker's native view was reused rather than replaced.
 */
let counter = 0;

export function createLocalId(prefix = 'id'): string {
  counter += 1;
  return `${prefix}_${counter.toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
