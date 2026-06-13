-- =====================================================================
-- IntenCiv Health Circle - Seed 002
-- Booklet tiers + tests (Basic, Family, Senior)
-- Generate UUIDs via UUID() so seeds remain deterministic on re-run via
-- session variables.
-- =====================================================================

USE `intenciv_db`;

SET @basic_id  = UUID();
SET @family_id = UUID();
SET @senior_id = UUID();

INSERT INTO `booklet_tiers` (`id`, `name`, `price`, `description`, `validity_days`, `is_active`)
VALUES
  (@basic_id,  'Basic',  799.00,  'Essential health checkup — 5 frequently used diagnostic tests at up to 50% off MRP.', 365, 1),
  (@family_id, 'Family', 1499.00, 'Comprehensive family plan — covers everyday wellness and preventive screening.',     365, 1),
  (@senior_id, 'Senior', 1299.00, 'Senior wellness — focused on heart, diabetes, kidney and bone health markers.',      365, 1);

-- Basic tier tests
INSERT INTO `tier_tests` (`id`, `tier_id`, `test_name`, `original_price`, `discounted_price`, `sort_order`) VALUES
  (UUID(), @basic_id, 'Complete Blood Count (CBC)',       400.00, 200.00, 1),
  (UUID(), @basic_id, 'Fasting Blood Sugar',              200.00, 100.00, 2),
  (UUID(), @basic_id, 'Lipid Profile',                    800.00, 400.00, 3),
  (UUID(), @basic_id, 'Liver Function Test (LFT)',        900.00, 450.00, 4),
  (UUID(), @basic_id, 'Thyroid Profile (T3, T4, TSH)',    700.00, 350.00, 5);

-- Family tier tests
INSERT INTO `tier_tests` (`id`, `tier_id`, `test_name`, `original_price`, `discounted_price`, `sort_order`) VALUES
  (UUID(), @family_id, 'Complete Blood Count (CBC)',         400.00,  200.00, 1),
  (UUID(), @family_id, 'Fasting Blood Sugar',                200.00,  100.00, 2),
  (UUID(), @family_id, 'HbA1c',                              600.00,  300.00, 3),
  (UUID(), @family_id, 'Lipid Profile',                      800.00,  400.00, 4),
  (UUID(), @family_id, 'Liver Function Test (LFT)',          900.00,  450.00, 5),
  (UUID(), @family_id, 'Kidney Function Test (KFT)',         900.00,  450.00, 6),
  (UUID(), @family_id, 'Thyroid Profile (T3, T4, TSH)',      700.00,  350.00, 7),
  (UUID(), @family_id, 'Vitamin D',                         1400.00,  700.00, 8),
  (UUID(), @family_id, 'Vitamin B12',                       1200.00,  600.00, 9),
  (UUID(), @family_id, 'Urine Routine',                      200.00,  100.00, 10);

-- Senior tier tests
INSERT INTO `tier_tests` (`id`, `tier_id`, `test_name`, `original_price`, `discounted_price`, `sort_order`) VALUES
  (UUID(), @senior_id, 'Complete Blood Count (CBC)',       400.00,  200.00, 1),
  (UUID(), @senior_id, 'Fasting Blood Sugar',              200.00,  100.00, 2),
  (UUID(), @senior_id, 'HbA1c',                            600.00,  300.00, 3),
  (UUID(), @senior_id, 'Lipid Profile',                    800.00,  400.00, 4),
  (UUID(), @senior_id, 'Liver Function Test (LFT)',        900.00,  450.00, 5),
  (UUID(), @senior_id, 'Kidney Function Test (KFT)',       900.00,  450.00, 6),
  (UUID(), @senior_id, 'Thyroid Profile (T3, T4, TSH)',    700.00,  350.00, 7),
  (UUID(), @senior_id, 'ECG',                              500.00,  250.00, 8),
  (UUID(), @senior_id, 'Vitamin D',                       1400.00,  700.00, 9),
  (UUID(), @senior_id, 'Calcium',                          300.00,  150.00, 10);
