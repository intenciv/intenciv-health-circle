-- =====================================================================
-- IntenCiv Health Circle - Schema (Revision 2)
-- Auth model: admin email+password, salesperson mobile+PIN, customer
-- mobile-only. OTP is only used during card activation to verify that
-- the customer's mobile is reachable. The activation security gate is
-- the salesperson's admin-assigned 4-digit PIN.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `intenciv_db`
  DEFAULT CHARACTER SET utf8mb4 DEFAULT COLLATE utf8mb4_unicode_ci;

USE `intenciv_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- Drop legacy tables from rev 1 if present.
DROP TABLE IF EXISTS coupons;
DROP TABLE IF EXISTS booklets;
DROP TABLE IF EXISTS activation_codes;
DROP TABLE IF EXISTS tier_tests;
DROP TABLE IF EXISTS booklet_tiers;
DROP TABLE IF EXISTS otp_log;
DROP TABLE IF EXISTS users;
DROP TABLE IF EXISTS offers;
DROP TABLE IF EXISTS plan_benefits;
DROP TABLE IF EXISTS plans;
DROP TABLE IF EXISTS cards;

-- ---------------------------------------------------------------------
-- users — admin, salesperson, customer
-- ---------------------------------------------------------------------
CREATE TABLE users (
  id              VARCHAR(36) NOT NULL,
  role            ENUM('admin','salesperson','customer') NOT NULL,
  phone           VARCHAR(15) DEFAULT NULL,   -- +91XXXXXXXXXX (unique when present)
  email           VARCHAR(150) DEFAULT NULL,  -- admins only
  full_name       VARCHAR(100) DEFAULT NULL,
  password_hash   VARCHAR(255) DEFAULT NULL,  -- bcrypt — admin only
  pin_hash        VARCHAR(255) DEFAULT NULL,  -- bcrypt of 4-digit PIN — salesperson only
  is_active       TINYINT(1)  NOT NULL DEFAULT 1,
  created_at      DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login      DATETIME    DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_phone (phone),
  UNIQUE KEY uq_users_email (email),
  KEY idx_users_role (role),
  KEY idx_users_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- plans — standard + corporate
-- ---------------------------------------------------------------------
CREATE TABLE plans (
  id                     VARCHAR(36) NOT NULL,
  name                   VARCHAR(80) NOT NULL,
  description            TEXT,
  price                  DECIMAL(8,2) NOT NULL,
  validity_days          INT NOT NULL DEFAULT 365,
  is_corporate           TINYINT(1) NOT NULL DEFAULT 0,
  corporate_client_name  VARCHAR(120) DEFAULT NULL,
  min_card_quantity      INT NOT NULL DEFAULT 1,
  is_active              TINYINT(1) NOT NULL DEFAULT 1,
  created_at             DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_plans_active (is_active),
  KEY idx_plans_corporate (is_corporate)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- plan_benefits — the 8 benefit definitions (per plan)
-- discount_type: free | percent | amount | bogo
-- ---------------------------------------------------------------------
CREATE TABLE plan_benefits (
  id              VARCHAR(36) NOT NULL,
  plan_id         VARCHAR(36) NOT NULL,
  benefit_code    VARCHAR(4)  NOT NULL,        -- HC, HM, VC, BG, SE, IC, MT, IS
  name            VARCHAR(120) NOT NULL,
  description     TEXT,
  num_coupons     INT NOT NULL DEFAULT 1,
  discount_type   ENUM('free','percent','amount','bogo') NOT NULL DEFAULT 'percent',
  discount_value  DECIMAL(8,2) DEFAULT NULL,   -- 30 = 30%, NULL when free/bogo
  conditions      TEXT,
  sort_order      INT NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_pb_plan (plan_id),
  CONSTRAINT fk_pb_plan FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- cards — physical card numbers. status state-machine:
--   unused → assigned → active → expired
-- ---------------------------------------------------------------------
CREATE TABLE cards (
  id                       VARCHAR(36) NOT NULL,
  card_number              VARCHAR(20) NOT NULL,       -- IHC-YYYY-NNNNN
  card_seq                 INT NOT NULL,               -- the NNNNN part (used in coupon codes)
  plan_id                  VARCHAR(36) NOT NULL,
  status                   ENUM('unused','assigned','active','expired') NOT NULL DEFAULT 'unused',
  assigned_to_salesperson  VARCHAR(36) DEFAULT NULL,
  customer_id              VARCHAR(36) DEFAULT NULL,
  activated_at             DATETIME DEFAULT NULL,
  expires_at               DATETIME DEFAULT NULL,
  activated_by_salesperson VARCHAR(36) DEFAULT NULL,
  amount_paid              DECIMAL(8,2) DEFAULT NULL,
  created_by_admin         VARCHAR(36) NOT NULL,
  created_at               DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cards_number (card_number),
  UNIQUE KEY uq_cards_seq (card_seq),
  KEY idx_cards_plan (plan_id),
  KEY idx_cards_status (status),
  KEY idx_cards_salesperson (assigned_to_salesperson),
  KEY idx_cards_customer (customer_id),
  CONSTRAINT fk_cards_plan        FOREIGN KEY (plan_id)                  REFERENCES plans(id) ON DELETE RESTRICT,
  CONSTRAINT fk_cards_assigned    FOREIGN KEY (assigned_to_salesperson)  REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_cards_customer    FOREIGN KEY (customer_id)              REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_cards_activatedby FOREIGN KEY (activated_by_salesperson) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_cards_admin       FOREIGN KEY (created_by_admin)         REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- coupons — generated when a card is activated (one row per coupon).
-- coupon_code: IHC-CPN-{5digit}-{benefit_code}{2-digit sequence}
-- ---------------------------------------------------------------------
CREATE TABLE coupons (
  id                  VARCHAR(36) NOT NULL,
  coupon_code         VARCHAR(30) NOT NULL,
  card_id             VARCHAR(36) NOT NULL,
  customer_id         VARCHAR(36) NOT NULL,
  benefit_id          VARCHAR(36) NOT NULL,
  benefit_code        VARCHAR(4)  NOT NULL,
  benefit_name        VARCHAR(120) NOT NULL,
  status              ENUM('unused','used','expired') NOT NULL DEFAULT 'unused',
  used_at             DATETIME DEFAULT NULL,
  used_by_admin       VARCHAR(36) DEFAULT NULL,
  expires_at          DATETIME NOT NULL,
  created_at          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_coupons_code (coupon_code),
  KEY idx_coupons_card (card_id),
  KEY idx_coupons_customer (customer_id),
  KEY idx_coupons_status (status),
  CONSTRAINT fk_coupons_card     FOREIGN KEY (card_id)       REFERENCES cards(id) ON DELETE CASCADE,
  CONSTRAINT fk_coupons_customer FOREIGN KEY (customer_id)   REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_coupons_benefit  FOREIGN KEY (benefit_id)    REFERENCES plan_benefits(id) ON DELETE RESTRICT,
  CONSTRAINT fk_coupons_admin    FOREIGN KEY (used_by_admin) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- otp_log — used ONLY during activation to verify mobile reachability.
-- ---------------------------------------------------------------------
CREATE TABLE otp_log (
  id          VARCHAR(36) NOT NULL,
  phone       VARCHAR(15) NOT NULL,
  otp_hash    VARCHAR(64) NOT NULL,
  purpose     ENUM('activation') NOT NULL DEFAULT 'activation',
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  attempts    INT NOT NULL DEFAULT 0,
  expires_at  DATETIME NOT NULL,
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_phone (phone),
  KEY idx_otp_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- offers — banners shown on the customer app home screen.
-- ---------------------------------------------------------------------
CREATE TABLE offers (
  id           VARCHAR(36) NOT NULL,
  title        VARCHAR(120) NOT NULL,
  subtitle     VARCHAR(200) DEFAULT NULL,
  image_url    TEXT,
  link_url     VARCHAR(255) DEFAULT NULL,
  is_active    TINYINT(1) NOT NULL DEFAULT 1,
  sort_order   INT NOT NULL DEFAULT 0,
  created_by   VARCHAR(36) NOT NULL,
  created_at   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_offers_active (is_active),
  CONSTRAINT fk_offers_admin FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sequence helper for card numbers
CREATE TABLE IF NOT EXISTS card_sequence (
  year_part INT PRIMARY KEY,
  last_seq  INT NOT NULL
) ENGINE=InnoDB;

SET FOREIGN_KEY_CHECKS = 1;
