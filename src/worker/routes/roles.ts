import { and, asc, eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createRoleSchema, updateRoleSchema, type RoleDto } from "../../shared/contracts/roles";
import { builtInRoleDefinitions, isReservedRoleName } from "../../shared/roles";
import { createDb } from "../db";
import { workspaceMembers, workspaceRolePermissions, workspaceRoles } from "../db/schema";
import { createId } from "../lib/id";
import { requireAuth, requirePermission } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";
import type { PermissionKey } from "../../shared/permissions";

type RolesEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};
function canGrantPermissions(auth: AuthContext, requested: readonly PermissionKey[]) {
  const isSystemAdministrator = auth.workspace.role === "owner" || auth.workspace.role === "admin";

  if (isSystemAdministrator) {
    return true;
  }

  const allowed = new Set(auth.workspace.permissions);

  return requested.every((permission) => allowed.has(permission));
}

export const rolesRoutes = new Hono<RolesEnv>();

rolesRoutes.get("/", requireAuth, requirePermission("roles.view"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const roleRows = await db
    .select({
      id: workspaceRoles.id,
      name: workspaceRoles.name,
      createdAt: workspaceRoles.createdAt,
      updatedAt: workspaceRoles.updatedAt,
    })
    .from(workspaceRoles)
    .where(eq(workspaceRoles.workspaceId, auth.workspace.id))
    .orderBy(asc(workspaceRoles.name));

  const permissionRows = await db
    .select({
      roleId: workspaceRolePermissions.roleId,

      permissionKey: workspaceRolePermissions.permissionKey,
    })
    .from(workspaceRolePermissions)
    .innerJoin(workspaceRoles, eq(workspaceRolePermissions.roleId, workspaceRoles.id))
    .where(eq(workspaceRoles.workspaceId, auth.workspace.id));

  const builtInRoles: RoleDto[] = builtInRoleDefinitions.map((role) => ({
    id: `builtin:${role.key}`,
    name: role.name,
    kind: "built_in",
    systemKey: role.key,
    permissions: [...role.permissions],
    createdAt: null,
    updatedAt: null,
  }));

  const customRoles: RoleDto[] = roleRows.map((role) => ({
    id: role.id,
    name: role.name,
    kind: "custom",
    systemKey: null,

    permissions: permissionRows.filter((permission) => permission.roleId === role.id).map((permission) => permission.permissionKey) as RoleDto["permissions"],

    createdAt: role.createdAt.toISOString(),

    updatedAt: role.updatedAt.toISOString(),
  }));

  return c.json({
    data: [...builtInRoles, ...customRoles],
  });
});

rolesRoutes.post(
  "/",
  requireAuth,
  requirePermission("roles.manage"),
  zValidator("json", createRoleSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid role data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const input = c.req.valid("json");

    if (!canGrantPermissions(auth, input.permissions)) {
      return c.json(
        {
          error: {
            code: "CANNOT_GRANT_PERMISSION",
            message: "You cannot grant permissions you do not have",
          },
        },
        403,
      );
    }

    const db = createDb(c.env.flow_db);

    if (isReservedRoleName(input.name)) {
      return c.json(
        {
          error: {
            code: "ROLE_NAME_RESERVED",
            message: "This role name is reserved",
          },
        },
        409,
      );
    }

    const existingRoles = await db
      .select({
        name: workspaceRoles.name,
      })
      .from(workspaceRoles)
      .where(eq(workspaceRoles.workspaceId, auth.workspace.id));

    const duplicate = existingRoles.some((role) => role.name.trim().toLowerCase() === input.name.trim().toLowerCase());

    if (duplicate) {
      return c.json(
        {
          error: {
            code: "ROLE_NAME_TAKEN",
            message: "A role with this name already exists",
          },
        },
        409,
      );
    }

    const id = createId("role");

    const now = new Date();

    await db.insert(workspaceRoles).values({
      id,
      workspaceId: auth.workspace.id,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    });

    if (input.permissions.length > 0) {
      await db.insert(workspaceRolePermissions).values(
        input.permissions.map((permissionKey) => ({
          roleId: id,
          permissionKey,
        })),
      );
    }

    const data: RoleDto = {
      id,
      name: input.name,
      kind: "custom",
      systemKey: null,
      permissions: input.permissions,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return c.json(
      {
        data,
      },
      201,
    );
  },
);

rolesRoutes.patch(
  "/:roleId",
  requireAuth,
  requirePermission("roles.manage"),
  zValidator("json", updateRoleSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid role data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const roleId = c.req.param("roleId");

    const input = c.req.valid("json");

    if (!canGrantPermissions(auth, input.permissions)) {
      return c.json(
        {
          error: {
            code: "CANNOT_GRANT_PERMISSION",
            message: "You cannot grant permissions you do not have",
          },
        },
        403,
      );
    }

    const db = createDb(c.env.flow_db);

    const [role] = await db
      .select({
        id: workspaceRoles.id,
        createdAt: workspaceRoles.createdAt,
      })
      .from(workspaceRoles)
      .where(and(eq(workspaceRoles.id, roleId), eq(workspaceRoles.workspaceId, auth.workspace.id)))
      .limit(1);

    if (!role) {
      return c.json(
        {
          error: {
            code: "ROLE_NOT_FOUND",
            message: "Role not found",
          },
        },
        404,
      );
    }

    if (isReservedRoleName(input.name)) {
      return c.json(
        {
          error: {
            code: "ROLE_NAME_RESERVED",
            message: "This role name is reserved",
          },
        },
        409,
      );
    }

    const otherRoles = await db
      .select({
        id: workspaceRoles.id,
        name: workspaceRoles.name,
      })
      .from(workspaceRoles)
      .where(eq(workspaceRoles.workspaceId, auth.workspace.id));

    const duplicate = otherRoles.some((otherRole) => otherRole.id !== roleId && otherRole.name.trim().toLowerCase() === input.name.trim().toLowerCase());

    if (duplicate) {
      return c.json(
        {
          error: {
            code: "ROLE_NAME_TAKEN",
            message: "A role with this name already exists",
          },
        },
        409,
      );
    }

    const now = new Date();

    await db
      .update(workspaceRoles)
      .set({
        name: input.name,
        updatedAt: now,
      })
      .where(and(eq(workspaceRoles.id, roleId), eq(workspaceRoles.workspaceId, auth.workspace.id)));

    await db.delete(workspaceRolePermissions).where(eq(workspaceRolePermissions.roleId, roleId));

    if (input.permissions.length > 0) {
      await db.insert(workspaceRolePermissions).values(
        input.permissions.map((permissionKey) => ({
          roleId,
          permissionKey,
        })),
      );
    }

    const data: RoleDto = {
      id: roleId,
      name: input.name,
      kind: "custom",
      systemKey: null,
      permissions: input.permissions,
      createdAt: role.createdAt.toISOString(),
      updatedAt: now.toISOString(),
    };

    return c.json({
      data,
    });
  },
);

rolesRoutes.delete("/:roleId", requireAuth, requirePermission("roles.manage"), async (c) => {
  const auth = c.var.auth;

  const roleId = c.req.param("roleId");

  const db = createDb(c.env.flow_db);

  const [role] = await db
    .select({
      id: workspaceRoles.id,
    })
    .from(workspaceRoles)
    .where(and(eq(workspaceRoles.id, roleId), eq(workspaceRoles.workspaceId, auth.workspace.id)))
    .limit(1);

  if (!role) {
    return c.json(
      {
        error: {
          code: "ROLE_NOT_FOUND",
          message: "Role not found",
        },
      },
      404,
    );
  }

  const [assignedMember] = await db
    .select({
      userId: workspaceMembers.userId,
    })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, auth.workspace.id), eq(workspaceMembers.customRoleId, roleId)))
    .limit(1);

  if (assignedMember) {
    return c.json(
      {
        error: {
          code: "ROLE_IN_USE",
          message: "Reassign members before deleting this role",
        },
      },
      409,
    );
  }
  await db.delete(workspaceRoles).where(and(eq(workspaceRoles.id, roleId), eq(workspaceRoles.workspaceId, auth.workspace.id)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});
