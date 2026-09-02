import { permissionKeys, type PermissionKey } from "./permissions";

import { adminPermissions, viewOnlyWorkspacePermissions } from "./roles";

export type PermissionGroup = {
  id: string;
  label: string;
  permissions: readonly PermissionKey[];
};

export const administratorPermissionGroups: readonly PermissionGroup[] = [
  {
    id: "full-control",
    label: "Full Control",
    permissions: permissionKeys,
  },

  {
    id: "manage-workspace",
    label: "Manage workspace",

    permissions: [
      "workspace.manage",

      "settings.view",
      "settings.manage",

      "members.view",
      "members.manage",

      "teams.view",
      "teams.manage",

      "roles.view",
      "roles.manage",

      "task_fields.view",
      "task_fields.manage",

      "task_appearance.view",
      "task_appearance.manage",
    ],
  },

  {
    id: "manage-members",
    label: "Manage members",
    permissions: ["members.view", "members.manage"],
  },

  {
    id: "manage-teams",
    label: "Manage teams",
    permissions: ["teams.view", "teams.manage"],
  },

  {
    id: "manage-roles",
    label: "Manage roles",
    permissions: ["roles.view", "roles.manage"],
  },

  {
    id: "manage-clients",
    label: "Manage clients",
    permissions: ["clients.view", "clients.create", "clients.edit", "clients.archive", "clients.delete"],
  },

  {
    id: "manage-projects",
    label: "Manage projects",
    permissions: ["projects.view", "projects.create", "projects.edit", "projects.assign", "projects.archive", "projects.delete", "projects.private.create", "projects.private.manage", "projects.private.view_all"],
  },

  {
    id: "manage-tasks",
    label: "Manage tasks",
    permissions: ["tasks.view", "tasks.create", "tasks.edit", "tasks.archive", "tasks.delete", "tasks.assign"],
  },
];

export const clientPermissionGroups: readonly PermissionGroup[] = [
  {
    id: "create-clients",
    label: "Create clients",
    permissions: ["clients.create"],
  },

  {
    id: "edit-clients",
    label: "Edit clients",
    permissions: ["clients.edit"],
  },

  {
    id: "archive-clients",
    label: "Archive clients",
    permissions: ["clients.archive"],
  },
  {
    id: "delete-clients",
    label: "Delete clients",
    permissions: ["clients.delete"],
  },
];

export const projectPermissionGroups: readonly PermissionGroup[] = [
  {
    id: "create-projects",
    label: "Create projects",
    permissions: ["projects.create"],
  },

  {
    id: "edit-projects",
    label: "Edit projects",
    permissions: ["projects.edit"],
  },
  {
    id: "assign-projects",
    label: "Assign projects",
    permissions: ["projects.assign"],
  },

  {
    id: "archive-projects",
    label: "Archive projects",
    permissions: ["projects.archive"],
  },

  {
    id: "delete-projects",
    label: "Delete projects",
    permissions: ["projects.delete"],
  },
];

export const taskPermissionGroups: readonly PermissionGroup[] = [
  {
    id: "create-tasks",
    label: "Create tasks",
    permissions: ["tasks.create"],
  },

  {
    id: "edit-tasks",
    label: "Edit tasks",
    permissions: ["tasks.edit"],
  },

  {
    id: "archive-tasks",
    label: "Archive tasks",
    permissions: ["tasks.archive"],
  },

  {
    id: "delete-tasks",
    label: "Delete tasks",
    permissions: ["tasks.delete"],
  },

  {
    id: "assign-tasks",
    label: "Assign tasks",
    permissions: ["tasks.assign"],
  },
];

export const viewOnlyPermissionGroups: readonly PermissionGroup[] = [
  {
    id: "only-workspace",
    label: "Only workspace",
    permissions: viewOnlyWorkspacePermissions,
  },
];

export const builtInPermissionPresets = [
  {
    id: "owner",
    label: "Owner",
    permissions: permissionKeys,
  },

  {
    id: "admin",
    label: "Admin",
    permissions: adminPermissions,
  },

  {
    id: "member",
    label: "Member",
    permissions: viewOnlyWorkspacePermissions,
  },
] as const;
