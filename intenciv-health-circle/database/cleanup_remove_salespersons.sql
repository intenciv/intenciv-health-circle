-- cleanup_remove_salespersons.sql
--
-- One-time data cleanup, run manually and only once — NOT part of the
-- numbered migration sequence (001-005), since this deletes data rather
-- than changing schema.
--
-- Removes every salesperson account, keeping the admin account and every
-- customer untouched. Cards a removed salesperson touched are NOT deleted
-- — assigned_to_salesperson / activated_by_salesperson on the cards table
-- are ON DELETE SET NULL, so all sales/card/coupon history stays intact,
-- it just stops being attributed to a specific (now-gone) person.
--
-- Run the SELECT first to see exactly who this will remove before running
-- the DELETE.

USE `intenciv_db`;

-- Preview — review this list before running the DELETE below.
SELECT id, full_name, phone, is_active, created_at
  FROM users
 WHERE role = 'salesperson'
 ORDER BY created_at;

-- Uncomment and run once you've reviewed the preview above.
-- DELETE FROM users WHERE role = 'salesperson';
