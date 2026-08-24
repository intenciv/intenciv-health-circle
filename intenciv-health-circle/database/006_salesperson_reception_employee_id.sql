-- 006_salesperson_reception_employee_id.sql
--
-- Extends the Employee ID login pattern (already applied to Admin) to
-- Salesperson and Reception accounts. Login for all three roles is now
-- Employee ID + password, harmonized with HRM/IVS/CRM.
--
-- Salesperson's separate 4-digit activation PIN is untouched by this —
-- it's still required to authorize each card activation in the field,
-- a different control from signing into the panel.
--
-- Safe to run on a database with real data: only assigns Employee IDs to
-- rows that don't have one yet (existing Admin row is skipped). Nothing
-- here deletes or overwrites full_name, phone, cards, or any customer
-- data. Written to be safe to re-run (a second run finds nothing left
-- with employee_id IS NULL among salesperson/reception rows and does
-- nothing).
--
-- Run this AFTER uploading the updated backend/frontend code, and BEFORE
-- relying on Salesperson/Reception login (their login will not work
-- until this has run, since the code now requires employee_id).

-- Sequential placeholders (INT0002, INT0003, ...) for every existing
-- salesperson/reception account that doesn't have an Employee ID yet,
-- ordered by when the account was created. INT0001 is already taken by
-- Admin, so this starts at INT0002. If you already know an employee's
-- real ID from HRM Employee Master, correct it afterwards — either with
-- a one-off UPDATE here, or from the Salespersons page's Edit screen.
SET @seq = 1;

UPDATE users u
JOIN (
  SELECT id, (@seq := @seq + 1) AS rn
    FROM users
   WHERE role IN ('salesperson', 'reception') AND employee_id IS NULL
   ORDER BY created_at ASC
) t ON t.id = u.id
   SET u.employee_id = CONCAT('INT', LPAD(t.rn, 4, '0'));

-- Verify: every salesperson/reception row should now show an employee_id.
-- SELECT id, role, employee_id, full_name, phone, email FROM users
--  WHERE role IN ('salesperson','reception') ORDER BY employee_id;
