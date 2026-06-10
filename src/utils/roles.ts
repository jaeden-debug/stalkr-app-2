/**
 * Crew role capabilities. Single source of truth for UI gating; mirrors the
 * RLS enforcement in migration 011 (server is authoritative — this is UX).
 *
 *   Owner     full control + transfer ownership + delete crew
 *   Admin     manage members / zones / markers / crew settings
 *   Moderator moderate + remove any marker/comment
 *   Member    standard participation (create own content, broadcast)
 *   Viewer    read-only
 */
import type { MemberRole } from '@/types/database';

export type Capability =
  | 'manageCrew'
  | 'manageMembers'
  | 'manageZones'
  | 'manageMarkers'
  | 'moderate'
  | 'transferOwnership'
  | 'deleteCrew'
  | 'contribute'
  | 'comment';

const RANK: Record<MemberRole, number> = { viewer: 0, member: 1, moderator: 2, admin: 3, owner: 4 };

const MIN_RANK: Record<Capability, number> = {
  contribute: 1,
  comment: 1,
  moderate: 2,
  manageMarkers: 3,
  manageZones: 3,
  manageCrew: 3,
  manageMembers: 3,
  transferOwnership: 4,
  deleteCrew: 4,
};

export function can(role: MemberRole | undefined | null, cap: Capability): boolean {
  if (!role) return false;
  return RANK[role] >= MIN_RANK[cap];
}

export const isViewer = (role?: MemberRole | null) => role === 'viewer';

export const ROLE_LABEL: Record<MemberRole, string> = {
  owner: 'Owner', admin: 'Admin', moderator: 'Moderator', member: 'Member', viewer: 'Viewer',
};

export const ROLE_COLOR: Record<MemberRole, string> = {
  owner: '#F59E0B', admin: '#4ADE80', moderator: '#60A5FA', member: 'rgba(255,255,255,0.6)', viewer: 'rgba(255,255,255,0.4)',
};

/** Roles an actor may assign to others (never owner; below own rank). */
export function assignableRoles(actorRole: MemberRole | undefined | null): MemberRole[] {
  if (!actorRole || RANK[actorRole] < MIN_RANK.manageMembers) return [];
  return (['admin', 'moderator', 'member', 'viewer'] as MemberRole[]).filter(
    (r) => RANK[r] < RANK[actorRole] || actorRole === 'owner',
  );
}
