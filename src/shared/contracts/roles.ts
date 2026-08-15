import * as z from "zod";

import { permissionKeySchema, permissionKeys, type PermissionKey } from "../permissions";
import type { BuiltInRoleKey } from "../roles";

const permissionsSchema = z
  .array(permissionKeySchema)
  .max(permissionKeys.length)
  .refine((permissions) => new Set(permissions).size === permissions.length, {
    message: "Permissions must be unique",
  });

export const createRoleSchema = z.object({
  name: z.string().trim().min(1).max(120),

  permissions: permissionsSchema,
});

export const updateRoleSchema = createRoleSchema;

export type CreateRoleInput = z.infer<typeof createRoleSchema>;

export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;

export type RoleDto = {
  id: string;
  name: string;

  kind: "built_in" | "custom";

  systemKey: BuiltInRoleKey | null;

  permissions: PermissionKey[];

  createdAt: string | null;

  updatedAt: string | null;
};

export type RolesResponse = {
  data: RoleDto[];
};

export type RoleResponse = {
  data: RoleDto;
};

export type DeleteRoleResponse = {
  data: {
    success: true;
  };
};
