CREATE TABLE IF NOT EXISTS contact_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_contact_rate_limits_window
  ON contact_rate_limits(window_started_at);
