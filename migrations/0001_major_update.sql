CREATE TABLE IF NOT EXISTS admin_credentials (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_newsletters (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for_iso TEXT NOT NULL,
  recipient_ids TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  sent_at TEXT
);

CREATE TABLE IF NOT EXISTS site_content (
  singleton_key TEXT PRIMARY KEY,
  published_json TEXT NOT NULL,
  draft_json TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS contact_submissions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  topic TEXT NOT NULL,
  message TEXT NOT NULL,
  page_url TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TEXT NOT NULL,
  read_at TEXT,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS activity_log (
  id TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  path TEXT NOT NULL,
  referrer TEXT,
  browser TEXT,
  device TEXT,
  visitor_id TEXT,
  metadata_json TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_contact_submissions_status_created ON contact_submissions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at DESC);
