-- =====================================================================
-- Seed: first admin account.
--
-- Default credentials:
--   email    : intencivhealthcare@gmail.com
--   password : 123456    (CHANGE IMMEDIATELY in production)
--
-- The password_hash below is a bcrypt hash of "123456" generated with
-- cost factor 10. Regenerate before production:
--   node -e "console.log(require('bcryptjs').hashSync('YourNewPassword', 10))"
-- =====================================================================

USE `intenciv_db`;

INSERT INTO users (id, role, email, full_name, password_hash, is_active, created_at)
VALUES (
  UUID(),
  'admin',
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
