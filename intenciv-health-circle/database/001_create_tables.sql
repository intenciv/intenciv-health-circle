-- =====================================================================
-- IntenCiv Health Circle - Schema Migration 001
-- Database: intenciv_db (MySQL 8.0, UTF8MB4, InnoDB)
-- All primary keys are UUID v4 stored as VARCHAR(36)
-- =====================================================================

CREATE DATABASE IF NOT EXISTS `intenciv_db`
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;

USE `intenciv_db`;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- users
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id`         VARCHAR(36)  NOT NULL,
  `phone`      VARCHAR(15)  NOT NULL,
  `full_name`  VARCHAR(100) DEFAULT NULL,
  `email`      VARCHAR(150) DEFAULT NULL,
  `address`    TEXT         DEFAULT NULL,
  `city`       VARCHAR(60)  DEFAULT NULL,
  `pincode`    VARCHAR(10)  DEFAULT NULL,
  `role`       ENUM('client','sales_agent','receptionist','admin') NOT NULL DEFAULT 'client',
  `is_active`  TINYINT(1)   NOT NULL DEFAULT 1,
  `created_at` DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `last_login` DATETIME     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_phone` (`phone`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- booklet_tiers
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `booklet_tiers` (
  `id`            VARCHAR(36) NOT NULL,
  `name`          VARCHAR(60) NOT NULL,
  `price`         DECIMAL(8,2) NOT NULL,
  `description`   TEXT DEFAULT NULL,
  `validity_days` INT NOT NULL DEFAULT 365,
  `is_active`     TINYINT(1) NOT NULL DEFAULT 1,
  `created_at`    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tiers_active` (`is_active`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- tier_tests
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tier_tests` (
  `id`               VARCHAR(36) NOT NULL,
  `tier_id`          VARCHAR(36) NOT NULL,
  `test_name`        VARCHAR(100) NOT NULL,
  `original_price`   DECIMAL(8,2) NOT NULL,
  `discounted_price` DECIMAL(8,2) NOT NULL,
  `sort_order`       INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_tier_tests_tier` (`tier_id`),
  CONSTRAINT `fk_tier_tests_tier`
    FOREIGN KEY (`tier_id`) REFERENCES `booklet_tiers` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- activation_codes
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `activation_codes` (
  `id`                  VARCHAR(36) NOT NULL,
  `code`                VARCHAR(20) NOT NULL,
  `tier_id`             VARCHAR(36) NOT NULL,
  `assigned_agent_id`   VARCHAR(36) DEFAULT NULL,
  `is_used`             TINYINT(1) NOT NULL DEFAULT 0,
  `used_at`             DATETIME DEFAULT NULL,
  `used_by_agent_id`    VARCHAR(36) DEFAULT NULL,
  `created_by_admin_id` VARCHAR(36) NOT NULL,
  `created_at`          DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_codes_code` (`code`),
  KEY `idx_codes_tier` (`tier_id`),
  KEY `idx_codes_assigned_agent` (`assigned_agent_id`),
  KEY `idx_codes_is_used` (`is_used`),
  CONSTRAINT `fk_codes_tier`
    FOREIGN KEY (`tier_id`) REFERENCES `booklet_tiers` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_codes_agent`
    FOREIGN KEY (`assigned_agent_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_codes_used_by`
    FOREIGN KEY (`used_by_agent_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `fk_codes_admin`
    FOREIGN KEY (`created_by_admin_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- booklets
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `booklets` (
  `id`                    VARCHAR(36) NOT NULL,
  `client_id`             VARCHAR(36) NOT NULL,
  `tier_id`               VARCHAR(36) NOT NULL,
  `sold_by_agent_id`      VARCHAR(36) NOT NULL,
  `activation_code_used`  VARCHAR(20) NOT NULL,
  `status`                ENUM('active','expired','suspended') NOT NULL DEFAULT 'active',
  `activated_at`          DATETIME NOT NULL,
  `expires_at`            DATETIME NOT NULL,
  `amount_paid`           DECIMAL(8,2) NOT NULL,
  `created_at`            DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_booklets_client` (`client_id`),
  KEY `idx_booklets_tier` (`tier_id`),
  KEY `idx_booklets_agent` (`sold_by_agent_id`),
  KEY `idx_booklets_status` (`status`),
  KEY `idx_booklets_expires` (`expires_at`),
  CONSTRAINT `fk_booklets_client`
    FOREIGN KEY (`client_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_booklets_tier`
    FOREIGN KEY (`tier_id`) REFERENCES `booklet_tiers` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_booklets_agent`
    FOREIGN KEY (`sold_by_agent_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- coupons
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `coupons` (
  `id`                         VARCHAR(36) NOT NULL,
  `booklet_id`                 VARCHAR(36) NOT NULL,
  `client_id`                  VARCHAR(36) NOT NULL,
  `test_name`                  VARCHAR(100) NOT NULL,
  `original_price`             DECIMAL(8,2) NOT NULL,
  `discounted_price`           DECIMAL(8,2) NOT NULL,
  `discount_percent`           DECIMAL(5,2) NOT NULL,
  `coupon_code`                VARCHAR(20) NOT NULL,
  `status`                     ENUM('active','availed','expired') NOT NULL DEFAULT 'active',
  `availed_at`                 DATETIME DEFAULT NULL,
  `availed_by_receptionist_id` VARCHAR(36) DEFAULT NULL,
  `expires_at`                 DATETIME NOT NULL,
  `created_at`                 DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_coupons_code` (`coupon_code`),
  KEY `idx_coupons_booklet` (`booklet_id`),
  KEY `idx_coupons_client` (`client_id`),
  KEY `idx_coupons_status` (`status`),
  KEY `idx_coupons_expires` (`expires_at`),
  CONSTRAINT `fk_coupons_booklet`
    FOREIGN KEY (`booklet_id`) REFERENCES `booklets` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_coupons_client`
    FOREIGN KEY (`client_id`) REFERENCES `users` (`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_coupons_receptionist`
    FOREIGN KEY (`availed_by_receptionist_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- otp_log
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `otp_log` (
  `id`          VARCHAR(36) NOT NULL,
  `phone`       VARCHAR(15) NOT NULL,
  `otp_hash`    VARCHAR(64) NOT NULL,
  `purpose`     ENUM('login','registration') NOT NULL DEFAULT 'login',
  `is_verified` TINYINT(1) NOT NULL DEFAULT 0,
  `attempts`    INT NOT NULL DEFAULT 0,
  `expires_at`  DATETIME NOT NULL,
  `created_at`  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_otp_phone` (`phone`),
  KEY `idx_otp_expires` (`expires_at`),
  KEY `idx_otp_verified` (`is_verified`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
