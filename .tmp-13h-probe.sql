INSERT INTO workspaces (
  id,
  name,
  slug,
  created_at,
  updated_at
)
VALUES (
  'ws_13h_probe',
  '13H Probe',
  '13h-probe',
  1724000000,
  1724000000
);

INSERT INTO users (
  id,
  discord_user_id,
  display_name,
  avatar_url,
  created_at,
  updated_at,
  last_login_at
)
VALUES (
  'usr_13h_probe',
  'discord_13h_probe',
  '13H Probe User',
  NULL,
  1724000000,
  1724000000,
  NULL
);

INSERT INTO clients (
  id,
  workspace_id,
  name,
  logo_url,
  status,
  created_at,
  updated_at,
  archived_at
)
VALUES (
  'cl_13h_probe',
  'ws_13h_probe',
  '13H Probe Client',
  NULL,
  'active',
  1724000000,
  1724000000,
  NULL
);

INSERT INTO projects (
  id,
  workspace_id,
  client_id,
  lead_user_id,
  name,
  project_code_override,
  description,
  engagement_type,
  visibility,
  status,
  start_date,
  due_date,
  discord_channel_url,
  created_at,
  updated_at,
  archived_at
)
VALUES (
  'prj_13h_probe',
  'ws_13h_probe',
  'cl_13h_probe',
  'usr_13h_probe',
  '13H Migration Probe',
  NULL,
  'Migration preservation probe',
  'retainer',
  'workspace',
  'active',
  '2026-08-01',
  NULL,
  NULL,
  1724000000,
  1724000000,
  NULL
);

INSERT INTO project_members (
  project_id,
  user_id,
  created_at
)
VALUES (
  'prj_13h_probe',
  'usr_13h_probe',
  1724000000
);

INSERT INTO project_task_statuses (
  project_id,
  status_key,
  label,
  position,
  enabled
)
VALUES
  ('prj_13h_probe', 'backlog', 'Backlog', 0, 1),
  ('prj_13h_probe', 'todo', 'To do', 1, 1),
  ('prj_13h_probe', 'in_progress', 'In progress', 2, 1),
  ('prj_13h_probe', 'review', 'Review', 3, 1),
  ('prj_13h_probe', 'done', 'Done', 4, 1);

INSERT INTO tasks (
  id,
  project_id,
  title,
  description,
  status,
  priority,
  assignee_id,
  due_date,
  sort_order,
  discord_thread_url,
  created_by,
  created_at,
  updated_at,
  archived_at
)
VALUES (
  'tsk_13h_probe',
  'prj_13h_probe',
  'Migration preservation task',
  NULL,
  'todo',
  'medium',
  'usr_13h_probe',
  NULL,
  0,
  NULL,
  'usr_13h_probe',
  1724000000,
  1724000000,
  NULL
);
