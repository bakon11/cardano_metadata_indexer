CREATE TABLE IF NOT EXISTS metadata(
  id INTEGER PRIMARY KEY autoincrement,
  slot INTEGER,
  block_hash VARCHAR,
  era VARCHAR,
  policy_id VARCHAR,
  asset_name VARCHAR,
  metadata TEXT
);
CREATE INDEX idx_policy_id ON metadata(policy_id);
CREATE INDEX idx_asset_name ON metadata(asset_name);
CREATE INDEX idx_policy_asset ON metadata(policy_id, asset_name);