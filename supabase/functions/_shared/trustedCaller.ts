/**
 * Is this request from a trusted server context?
 *
 * The obvious check — compare the bearer to SUPABASE_SERVICE_ROLE_KEY — is
 * brittle, and it broke in production: the value Supabase injects into that env
 * var is not necessarily the same string as the legacy service_role JWT an
 * operator stores in Vault. A correctly configured system returned 403.
 *
 * The durable check is the token's ROLE CLAIM. These functions run with
 * verify_jwt enabled, so the platform has already validated the signature
 * against this project's JWT secret before our code is reached. A token
 * arriving here is therefore authentically ours; the only remaining question is
 * which role it carries, which is exactly what we need to know.
 *
 * Signature verification is NOT performed here and must not be inferred from
 * this function alone — it is the gateway's job, and these functions must stay
 * deployed with verify_jwt ENABLED for this reasoning to hold.
 */

/** Roles permitted to invoke server-only functions. */
const TRUSTED_ROLES = new Set(['service_role']);

export function isTrustedServerCaller(bearer: string, serviceRoleKey: string): boolean {
  if (!bearer) return false;

  // Exact match still counts, for the new-style sb_secret_... keys which are
  // not JWTs and carry no claims.
  if (serviceRoleKey && bearer === serviceRoleKey) return true;

  const claims = decodeJwtClaims(bearer);
  return typeof claims?.role === 'string' && TRUSTED_ROLES.has(claims.role as string);
}

/**
 * Read a JWT's payload without verifying it.
 *
 * Safe ONLY because the gateway verified the signature first. Never call this
 * from a context where verify_jwt is disabled.
 */
export function decodeJwtClaims(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as Record<string, unknown>;
  } catch {
    return null;
  }
}
