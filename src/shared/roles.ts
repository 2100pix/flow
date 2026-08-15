import { permissionKeys, type PermissionKey } from "./permissions";

export type BuiltInRoleKey = "owner" | "admin" | "member";

export type BuiltInRoleDefinition = {
  key: BuiltInRoleKey;
  name: string;
  permissions: readonly PermissionKey[];
};

const memberPermissions = ["members.view", "teams.view", "clients.view", "projects.view", "tasks.view", "tasks.create", "tasks.edit", "tasks.archive", "tasks.assign"] as const satisfies readonly PermissionKey[];

export const builtInRoleDefinitions: readonly BuiltInRoleDefinition[] = [
  {
    key: "owner",
    name: "Owner",
    permissions: permissionKeys,
  },

  {
    key: "admin",
    name: "Admin",
    permissions: permissionKeys,
  },

  {
    key: "member",
    name: "Member",
    permissions: memberPermissions,
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
