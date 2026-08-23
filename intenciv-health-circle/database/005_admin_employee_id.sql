-- 005_admin_employee_id.sql
--
-- Cross-app credential harmonization: the admin account now logs in with
-- an Employee ID (format INT0001, assigned in HRM Employee Master) instead
-- of email — matching the same login scheme now used across HRM, IVS, and
-- CRM. Email stays on the row as contact info only, no longer used to sign
-- in. Password policy (enforced in application code, not here) is now:
-- minimum 8 characters, one capital letter, one numeral, one special
-- character.
--
-- Safe to run on a database that already has real data: this only adds a
-- column + unique index and backfills the existing admin row(s) — nothing
-- here deletes or overwrites anything else. Written to be safe to re-run.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS employee_id VARCHAR(20) NULL AFTER role;

ALTER TABLE users
  ADD UNIQUE KEY IF NOT EXISTS uq_users_employee_id (employee_id);

-- Backfill: give the (first, by creation order) admin row that doesn't
-- already have one the default INT0001. If you already know your real
-- Employee ID from HRM Employee Master, update it afterwards instead:
--   UPDATE users SET employee_id = 'INT0007' WHERE role = 'admin' AND employee_id = 'INT0001';
-- ORDER BY + LIMIT keeps this safe even if more than one admin row exists
-- (each admin needs a distinct ID — set any additional ones manually).
UPDATE users
   SET employee_id = 'INT0001'
 WHERE role = 'admin' AND employee_id IS NULL
 ORDER BY created_at ASC
 LIMIT 1;
