-- 004_otp_log_customer_login.sql
--
-- Formally captures schema that the live database already has but that
-- was never checked into a tracked migration file: routes/salesperson.js
-- already inserts into otp_log with a log_id column (needed for the
-- Authkey 2FA API's LogID-based verification), and the legacy
-- routes/auth.js customer-login flow already inserts with
-- purpose='customer_login', neither of which 001_create_tables.sql
-- accounts for (log_id doesn't exist there at all; purpose is defined as
-- ENUM('activation') only). This migration is written to be safe to run
-- whether or not the live database already has these changes applied
-- out-of-band.
--
-- Part of switching customer login to use the proper Authkey 2FA API
-- (services/authkey.js, LogID-based) instead of the old free-text-message
-- OTP path (utils/otp.js) - see routes/auth.js and this migration's sibling
-- code changes for the full context.

ALTER TABLE otp_log
  ADD COLUMN IF NOT EXISTS log_id VARCHAR(64) NULL AFTER otp_hash;

ALTER TABLE otp_log
  MODIFY COLUMN purpose ENUM('activation', 'customer_login') NOT NULL DEFAULT 'activation';
