-- =====================================================================
-- IntenCiv Health Circle - Seed 003
-- First admin user. Replace phone with the real admin number before
-- running in production. Admins log in via OTP just like every other
-- user — no password is needed.
-- =====================================================================

USE `intenciv_db`;

INSERT INTO `users` (`id`, `phone`, `full_name`, `email`, `role`, `is_active`)
VALUES (
  UUID(),
  '+919999999999',           -- TODO: change to real admin mobile (E.164 +91XXXXXXXXXX)
  'IntenCiv Admin',
  'admin@intenciv.in',
  'admin',
  1
)
ON DUPLICATE KEY UPDATE
  role = 'admin',
  is_active = 1,
  full_name = VALUES(full_name),
  email = VALUES(email);
