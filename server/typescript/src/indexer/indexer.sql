CREATE TABLE IF NOT EXISTS metadata(
  id INTEGER PRIMARY KEY autoincrement,
  slot INTEGER,
  block_hash VARCHAR,
  era VARCHAR,
  label VARCHAR,
  policy_id VARCHAR,
  asset_name VARCHAR,
  metadata TEXT
);
CREATE INDEX idx_policy_id ON metadata_mainnet(policy_id);
CREATE INDEX idx_asset_name ON metadata_mainnet(asset_name);
CREATE INDEX idx_policy_asset ON metadata_mainnet(policy_id, asset_name);

