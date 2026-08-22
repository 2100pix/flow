import { permissionKeys, type PermissionKey } from "./permissions";

export type BuiltInRoleKey = "owner" | "admin" | "member";

export type BuiltInRoleDefinition = {
  key: BuiltInRoleKey;

  name: string;

  permissions: readonly PermissionKey[];
};

export const viewOnlyWorkspacePermissions = ["dashboard.view", "members.view", "teams.view", "clients.view", "projects.view", "tasks.view"] as const satisfies readonly PermissionKey[];

export const adminPermissions = [
  "dashboard.view",

  // Required to enter workspace
  // Settings shell.
  "settings.view",

  "members.view",
  "members.manage",

  "teams.view",
  "teams.manage",

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
  "tasks.delete",
  "tasks.assign",
] as const satisfies readonly PermissionKey[];

export const builtInRoleDefinitions: readonly BuiltInRoleDefinition[] = [
  {
    key: "owner",

    name: "Owner",

    permissions: permissionKeys,
  },

  {
    key: "admin",

    name: "Admin",

    permissions: adminPermissions,
  },

  {
    key: "member",

    name: "Member",

    permissions: viewOnlyWorkspacePermissions,
  },
];

export function isReservedRoleName(value: string) {
  const normalized = value.trim().toLowerCase();

  return builtInRoleDefinitions.some((role) => role.name.toLowerCase() === normalized);
}

export function hasFullControl(permissions: readonly PermissionKey[]) {
  const selected = new Set(permissions);

  return permissionKeys.every((permission) => selected.has(permission));
}
