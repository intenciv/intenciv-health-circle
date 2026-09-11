/**
 * Multi-role helpers (see database/007_multi_role.sql).
 *
 *   users.role  — the person's primary role. Still what the JWT carries and
 *                 what requireRole() and the frontend route guards compare,
 *                 so none of that layer had to change.
 *   users.roles — SET of every capability the person holds; always contains
 *                 `role`. This is what authorisation reads.
 *
 * A receptionist who also sells has role='reception', roles='reception,salesperson'.
 * They sign in through whichever login endpoint matches the hat they want to
 * wear, and the token is scoped to that role for the session.
 */

const ALL_ROLES = ['admin', 'salesperson', 'customer', 'reception'];

/**
 * SQL predicate testing whether a row holds a capability. Takes one `?`.
 *
 * COALESCE(NULLIF(roles,''), role) means a row whose `roles` was never
 * backfilled still authorises on its primary role, so the code is safe to
 * deploy before (or without) the migration's UPDATE having run.
 */
const HAS_ROLE_SQL = "FIND_IN_SET(?, COALESCE(NULLIF(roles, ''), role)) > 0";

/** Parses a users row into a capability array, falling back to `role`. */
function rolesOf(row) {
  if (!row) return [];
  const raw = row.roles || row.role || '';
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

/** Validates + normalises a requested capability list. Always keeps `primary`. */
function normaliseRoles(requested, primary) {
  const set = new Set();
  if (primary) set.add(primary);
  for (const r of Array.isArray(requested) ? requested : []) {
    const v = String(r || '').trim().toLowerCase();
    if (ALL_ROLES.includes(v)) set.add(v);
  }
  return [...set];
}

/**
 * Shapes the user object returned by a login endpoint. `role` is the one they
 * signed in through (what guards check); `roles` lets the panel tell them they
 * also hold another one.
 */
function loginUser(row, activeRole) {
  const { password_hash, pin_hash, roles, ...rest } = row;
  return { ...rest, role: activeRole, roles: rolesOf(row) };
}

module.exports = { ALL_ROLES, HAS_ROLE_SQL, rolesOf, normaliseRoles, loginUser };
