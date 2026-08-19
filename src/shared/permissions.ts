import * as z from "zod";

export const permissionKeys = [
  "workspace.manage",
  "dashboard.view",

  "members.view",
  "members.manage",

  "teams.view",
  "teams.manage",

  "roles.view",
  "roles.manage",

  "clients.view",
  "clients.create",
  "clients.edit",
  "clients.archive",

  "projects.view",
  "projects.create",
  "projects.edit",
  "projects.archive",
  "projects.delete",
  "projects.private.create",
  "projects.private.manage",
  "projects.private.view_all",

  "tasks.view",
  "tasks.create",
  "tasks.edit",
  "tasks.archive",
  "tasks.assign",

  "settings.view",
  "settings.manage",

  "task_fields.view",
  "task_fields.manage",

  "task_appearance.view",
  "task_appearance.manage",
] as const;

export const permissionKeySchema = z.enum(permissionKeys);
export type PermissionKey = (typeof permissionKeys)[number];
export const permissionKeyListSchema = z
  .array(permissionKeySchema)
  .max(permissionKeys.length)
  .refine((permissions) => new Set(permissions).size === permissions.length, {
    message: "Permissions must be unique",
  });

export function parsePermissionKeys(values: readonly unknown[]): PermissionKey[] | null {
  const parsed = permissionKeyListSchema.safeParse([...values]);

  return parsed.success ? parsed.data : null;
}
export const permissionCatalog: Array<{
  key: PermissionKey;
  group: string;
  label: string;
}> = [
  {
    key: "workspace.manage",
    group: "Workspace",
    label: "Manage workspace",
  },
  {
    key: "dashboard.view",
    group: "Dashboard",
    label: "View dashboard",
  },
  {
    key: "members.view",
    group: "Members",
    label: "View members",
  },
  {
    key: "members.manage",
    group: "Members",
    label: "Manage members",
  },

  {
    key: "teams.view",
    group: "Teams",
    label: "View teams",
  },
  {
    key: "teams.manage",
    group: "Teams",
    label: "Manage teams",
  },

  {
    key: "roles.view",
    group: "Roles",
    label: "View roles",
  },
  {
    key: "roles.manage",
    group: "Roles",
    label: "Manage roles",
  },

  {
    key: "clients.view",
    group: "Clients",
    label: "View clients",
  },
  {
    key: "clients.create",
    group: "Clients",
    label: "Create clients",
  },
  {
    key: "clients.edit",
    group: "Clients",
    label: "Edit clients",
  },
  {
    key: "clients.archive",
    group: "Clients",
    label: "Archive clients",
  },

  {
    key: "projects.view",
    group: "Projects",
    label: "View projects",
  },
  {
    key: "projects.create",
    group: "Projects",
    label: "Create projects",
  },
  {
    key: "projects.edit",
    group: "Projects",
    label: "Edit projects",
  },
  {
    key: "projects.archive",
    group: "Projects",
    label: "Archive projects",
  },
  {
    key: "projects.delete",
    group: "Projects",
    label: "Delete projects permanently",
  },
  {
    key: "projects.private.create",
    group: "Projects",
    label: "Create private projects",
  },
  {
    key: "projects.private.manage",
    group: "Projects",
    label: "Manage private project access",
  },
  {
    key: "projects.private.view_all",
    group: "Projects",
    label: "View all private projects",
  },

  {
    key: "tasks.view",
    group: "Tasks",
    label: "View tasks",
  },
  {
    key: "tasks.create",
    group: "Tasks",
    label: "Create tasks",
  },
  {
    key: "tasks.edit",
    group: "Tasks",
    label: "Edit tasks",
  },
  {
    key: "tasks.archive",
    group: "Tasks",
    label: "Archive tasks",
  },
  {
    key: "tasks.assign",
    group: "Tasks",
    label: "Assign tasks",
  },

  {
    key: "settings.view",
    group: "Settings",
    label: "View settings",
  },
  {
    key: "settings.manage",
    group: "Settings",
    label: "Manage settings",
  },

  {
    key: "task_fields.view",
    group: "Task Fields",
    label: "View task fields",
  },
  {
    key: "task_fields.manage",
    group: "Task Fields",
    label: "Manage task fields",
  },

  {
    key: "task_appearance.view",
    group: "Task Appearance",
    label: "View task appearance",
  },
  {
    key: "task_appearance.manage",
    group: "Task Appearance",
    label: "Manage task appearance",
  },
];
