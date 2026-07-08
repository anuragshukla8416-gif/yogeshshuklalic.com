-- ============================================================
-- Yogesh Shukla Wealth Advisory — Database Schema (PostgreSQL)
-- ============================================================
-- Run this once against a fresh database:
--   psql "postgres://user:pass@host:5432/yogesh_advisory" -f schema.sql
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto; -- for gen_random_uuid(), used as public lead IDs

-- ------------------------------------------------------------
-- CLIENTS — every verified contact that has logged in
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clients (
  id            SERIAL PRIMARY KEY,
  contact       VARCHAR(255) NOT NULL,
  channel       VARCHAR(10)  NOT NULL CHECK (channel IN ('mobile','email')),
  first_seen_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (contact, channel)
);

-- ------------------------------------------------------------
-- OTP VERIFICATIONS — short-lived one-time-password requests
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_verifications (
  id           SERIAL PRIMARY KEY,
  contact      VARCHAR(255) NOT NULL,
  channel      VARCHAR(10)  NOT NULL CHECK (channel IN ('mobile','email')),
  otp_hash     VARCHAR(255) NOT NULL,      -- OTP is stored hashed, never in plain text
  expires_at   TIMESTAMPTZ  NOT NULL,
  attempts     INT          NOT NULL DEFAULT 0,
  verified     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_otp_contact_channel ON otp_verifications (contact, channel, created_at DESC);

-- ------------------------------------------------------------
-- LEADS — the master ledger backing the Admin Workspace
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_contact  VARCHAR(255) NOT NULL,
  client_channel  VARCHAR(10)  NOT NULL CHECK (client_channel IN ('mobile','email')),
  vertical        VARCHAR(50)  NOT NULL,   -- Life Insurance / Health Insurance / Mutual Fund / Motor Insurance
  category        VARCHAR(100) NOT NULL,   -- e.g. "Pure Protection", "Family Floater"
  plan_no         VARCHAR(20),
  plan_name       VARCHAR(255) NOT NULL,
  invest_amount   NUMERIC(14,2),
  tenure_years    INT,
  frequency       VARCHAR(20),             -- Monthly / Quarterly / Yearly
  action_type     VARCHAR(30)  NOT NULL CHECK (action_type IN ('Request Quote','Official Brochure')),
  note            TEXT,
  status          VARCHAR(20)  NOT NULL DEFAULT 'New' CHECK (status IN ('New','Contacted','Policy Issued')),
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_status     ON leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_vertical   ON leads (vertical);
CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_contact    ON leads (client_contact);

-- ------------------------------------------------------------
-- REVOKED TOKENS — supports real logout (JWTs are otherwise
-- valid until they naturally expire)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS revoked_tokens (
  jti         VARCHAR(64) PRIMARY KEY,
  revoked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at  TIMESTAMPTZ NOT NULL  -- mirrors the JWT's own expiry, so old rows can be purged safely
);

CREATE INDEX IF NOT EXISTS idx_revoked_tokens_expires ON revoked_tokens (expires_at);

-- Keep updated_at current on every row update
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION set_updated_at();
