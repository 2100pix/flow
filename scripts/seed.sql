INSERT OR IGNORE INTO workspaces (
  id,
  name,
  slug,
  created_at,
  updated_at
)
VALUES (
  'ws_invs',
  'INVS Studio',
  'invs-studio',
  unixepoch(),
  unixepoch()
);