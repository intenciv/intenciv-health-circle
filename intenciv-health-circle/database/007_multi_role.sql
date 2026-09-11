-- 007_multi_role.sql
--
-- Lets one person hold more than one role — specifically a receptionist who
-- also sells memberships. Until now `role` was a single ENUM, so an account
-- was either reception or salesperson and never both, and the only workaround
-- was two separate logins for one human (which the UNIQUE constraints on
-- employee_id / phone / email make awkward anyway).
--
-- Design: `roles` (a SET) becomes the list of capabilities a person holds and
-- is what authorisation checks read. `role` stays exactly as it is — the
-- person's primary role, still carried in the JWT and still what every
-- requireRole() guard and frontend route guard compares against. Login
-- endpoints check `roles` for the capability, then issue a token whose `role`
-- is the one they signed in through. That keeps the whole middleware and
-- frontend layer untouched: a receptionist-who-also-sells picks Salesperson or
-- Reception on the login screen and gets a session scoped to that.
--
-- Safe on live data: adds one column and backfills it from `role`, so every
-- existing account keeps exactly the access it has today. Nothing is deleted
-- and no existing column is modified.
--
-- MySQL (9.x here) has no ADD COLUMN IF NOT EXISTS — that is MariaDB syntax,
-- which is why 004 never applied cleanly. Re-running this after it has
-- succeeded will fail on the ALTER with "Duplicate column name 'roles'";
-- that is harmless, and the UPDATE below is safe to run on its own at any
-- time.

ALTER TABLE users
  ADD COLUMN roles SET('admin','salesperson','customer','reception')
  NOT NULL DEFAULT '' AFTER role;

-- Every existing account keeps precisely the access it already had.
UPDATE users SET roles = role WHERE roles = '' OR roles IS NULL;

-- Verify: `roles` should contain `role` for every row, and the count of rows
-- where it does not should be zero.
-- SELECT role, roles, COUNT(*) FROM users GROUP BY role, roles;
-- SELECT COUNT(*) AS broken FROM users WHERE NOT FIND_IN_SET(role, roles);
