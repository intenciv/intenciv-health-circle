-- =====================================================================
-- Seed: Standard Plan + 8 standard benefits (₹999 / 1 year).
-- Edit and re-run as needed before going live.
-- =====================================================================

USE `intenciv_db`;

SET @plan_id = UUID();

INSERT INTO plans (id, name, description, price, validity_days, is_corporate, min_card_quantity, is_active)
VALUES (@plan_id,
        'Standard',
        'IntenCiv Health Privilege Card — 8 benefits across diagnostics, home collection, family screening and Intenshe packages. Valid 1 year.',
        999.00, 365, 0, 1, 1);

INSERT INTO plan_benefits (id, plan_id, benefit_code, name, description, num_coupons, discount_type, discount_value, conditions, sort_order) VALUES
  (UUID(), @plan_id, 'HC', 'Free Health Check-up',           'One complimentary basic health check-up at any IntenCiv lab.',                                                       1, 'free',    NULL, 'Appointment must be booked in advance. Fasting may be required.',                                                  1),
  (UUID(), @plan_id, 'HM', 'Free Home Sample Collection',    'Phlebotomist visits your home to collect samples — no service charges.',                                            3, 'free',    NULL, 'Available within IntenCiv home-collection service area.',                                                          2),
  (UUID(), @plan_id, 'VC', 'Free Vital Checks',              'Walk-in vitals: BP, SpO2, pulse, glucose, weight.',                                                                  3, 'free',    NULL, 'Available at any IntenCiv reception during business hours.',                                                        3),
  (UUID(), @plan_id, 'BG', 'BOGO Health Package',            'Buy one Advance or Premium health package, get the same package free for a family member.',                          1, 'bogo',    NULL, 'Customer selects the package from www.intenciv.in. Both tests must be booked together at the same lab visit.',     4),
  (UUID(), @plan_id, 'SE', 'Support Elderly — Free Basic Test', 'Refer a known patient of Cardiac, Kidney, Gastro or Cancer — basic testing is free for that patient.',           4, 'free',    NULL, 'Patient must present medical history records proving they are a known patient of the relevant condition.',         5),
  (UUID(), @plan_id, 'IC', '30% off In-house Testing',       '30% off all in-house testing at IntenCiv labs.',                                                                     2, 'percent', 30,   'Cannot be combined with any other discount or package offer.',                                                      6),
  (UUID(), @plan_id, 'MT', 'Maternity 35% off',              '35% discount on all tests for a pregnant woman.',                                                                    1, 'percent', 35,   'Applicable only to tests booked under the pregnant member''s name. Doctor''s prescription required.',              7),
  (UUID(), @plan_id, 'IS', '20% off Intenshe Packages',      '20% discount on any health package from Intenshe (an initiative of IntenCiv Diagnostics).',                          2, 'percent', 20,   'Applicable on Intenshe-branded packages only. Not combinable with other discounts.',                                8);
