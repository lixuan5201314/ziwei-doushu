export const advancedSchema = `
CREATE TABLE IF NOT EXISTS auth_super_admins (
  user_id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS query_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL CHECK (feature IN ('chart', 'interpret', 'heming')),
  status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
  created_at TEXT NOT NULL,
  details TEXT
);

CREATE INDEX IF NOT EXISTS query_records_recent_idx ON query_records(created_at DESC, id DESC);
`;
