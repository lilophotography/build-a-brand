-- Build a Brand — initial schema
-- Replaces the original Supabase schema (users + brand_progress).
-- Adds onboarding fields directly on users; no separate user_meta table needed.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,                 -- internal UUID (we generate)
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,         -- PBKDF2-SHA256, 100k iterations, salt:hash:iterations base64
  first_name TEXT,
  business_name TEXT,
  website TEXT,
  has_access INTEGER NOT NULL DEFAULT 0,    -- 0/1, flipped true by Stripe webhook
  tier TEXT,                                -- 'course' | 'coaching' | NULL until paid
  has_call_credit INTEGER NOT NULL DEFAULT 0, -- 1 if entitled to a strategy call (coaching tier or upsell)
  call_booked_at TEXT,                      -- ISO timestamp once Lisa confirms the call is scheduled
  stripe_customer_id TEXT,
  onboarded INTEGER NOT NULL DEFAULT 0,     -- 0 until they complete the 3-question onboarding
  welcomed INTEGER NOT NULL DEFAULT 0,      -- 0 until they've seen the Lisa welcome page once
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  last_active_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_stripe ON users(stripe_customer_id);

CREATE TABLE IF NOT EXISTS brand_progress (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tool TEXT NOT NULL CHECK (tool IN ('vision','value','voice','visuals','visibility')),
  completed INTEGER NOT NULL DEFAULT 0,
  messages TEXT NOT NULL DEFAULT '[]',  -- JSON array of {role, content}
  summary TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, tool)
);

CREATE INDEX IF NOT EXISTS idx_progress_user ON brand_progress(user_id);

-- Stripe events log for replay protection + debugging
CREATE TABLE IF NOT EXISTS stripe_events (
  id TEXT PRIMARY KEY,                  -- Stripe event ID, deduplication key
  type TEXT NOT NULL,
  user_id TEXT,
  raw TEXT,
  received_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);
