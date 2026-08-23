-- =====================================================================
-- Seed: first admin account. Only used on a brand-new database — a
-- database that already has an admin row should use
-- 005_admin_employee_id.sql to add employee_id instead of re-running this.
--
-- Default credentials:
--   Employee ID : INT0001   (change to your real HRM Employee ID once known)
--   password    : 123456    (CHANGE IMMEDIATELY in production — must be
--                            re-set to meet the password policy: min 8
--                            characters, 1 capital, 1 numeral, 1 special
--                            character, via POST /admin/change-password)
--
-- The password_hash below is a bcrypt hash of "123456" generated with
-- cost factor 10. Regenerate before production:
--   node -e "console.log(require('bcryptjs').hashSync('YourNewPassword', 10))"
-- =====================================================================

USE `intenciv_db`;

INSERT INTO users (id, role, employee_id, email, full_name, password_hash, is_active, created_at)
VALUES (
  UUID(),
  'admin',
  'INT0001',
  'intencivhealthcare@gmail.com',
  'IntenCiv Admin',
  '$2a$10$rkqIVJ8t6Sn1qIVPyPjyEOjnNDqKkpzg5pGzVJ8M/y6Vc2GgY8Hp.',
  1,
  NOW()
)
ON DUPLICATE KEY UPDATE
  role = 'admin',
  is_active = 1,
  full_name = VALUES(full_name);
