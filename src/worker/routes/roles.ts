import { and, asc, eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createRoleSchema, reorderRolesSchema, updateRoleSchema, type RoleDto } from "../../shared/contracts/roles";
import { builtInRoleDefinitions, getPermissionWeight, hasFullControl, isReservedRoleName } from "../../shared/roles";
import { createDb } from "../db";
import { workspaceMembers, workspaceRolePermissions, workspaceRoles } from "../db/schema";
import { createId } from "../lib/id";
import { dispatchDiscordOutboxEvent } from "../lib/discord-outbox";
import { insertForumAccessSyncForWorkspace } from "../lib/project-discord-forum";
import { requireAuth, requirePermission } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";
import { parsePermissionKeys, type PermissionKey } from "../../shared/permissions";

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
      position: workspaceRoles.position,
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
    position: null,
    createdAt: null,
    updatedAt: null,
  }));

  const customRoles: RoleDto[] = [];

  for (const role of roleRows) {
    const rawPermissions = permissionRows.filter((permission) => permission.roleId === role.id).map((permission) => permission.permissionKey);

    const parsedPermissions = parsePermissionKeys(rawPermissions);

    if (!parsedPermissions) {
      return c.json(
        {
          error: {
            code: "ROLE_PERMISSION_INTEGRITY_ERROR",
            message: "Stored role permissions are invalid",
          },
        },
        500,
      );
    }

    customRoles.push({
      id: role.id,
      name: role.name,
      kind: "custom",
      systemKey: null,
      permissions: parsedPermissions,
      position: role.position,
      createdAt: role.createdAt.toISOString(),

      updatedAt: role.updatedAt.toISOString(),
    });
  }

  const manualOrderActive = customRoles.some((role) => role.position !== null);

  const sortCustomRoles = (first: RoleDto, second: RoleDto) => {
    if (manualOrderActive) {
      const firstPosition = first.position ?? Number.MAX_SAFE_INTEGER;

      const secondPosition = second.position ?? Number.MAX_SAFE_INTEGER;

      if (firstPosition !== secondPosition) {
        return firstPosition - secondPosition;
      }
    }

    const weightDifference = getPermissionWeight(second.permissions) - getPermissionWeight(first.permissions);

    if (weightDifference !== 0) {
      return weightDifference;
    }

    return first.name.localeCompare(second.name);
  };

  const fullControlRoles = customRoles.filter((role) => hasFullControl(role.permissions)).sort(sortCustomRoles);
  const regularRoles = customRoles.filter((role) => !hasFullControl(role.permissions)).sort(sortCustomRoles);
  const ownerRole = builtInRoles.find((role) => role.systemKey === "owner");
  const adminRole = builtInRoles.find((role) => role.systemKey === "admin");
  const memberRole = builtInRoles.find((role) => role.systemKey === "member");

  return c.json({
    data: [...(ownerRole ? [ownerRole] : []), ...fullControlRoles, ...(adminRole ? [adminRole] : []), ...regularRoles, ...(memberRole ? [memberRole] : [])],
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

    const roleInsert = db.insert(workspaceRoles).values({
      id,
      workspaceId: auth.workspace.id,
      name: input.name,
      createdAt: now,
      updatedAt: now,
    });

    if (input.permissions.length > 0) {
      await db.batch([
        roleInsert,

        db.insert(workspaceRolePermissions).values(
          input.permissions.map((permissionKey) => ({
            roleId: id,
            permissionKey,
          })),
        ),
      ]);
    } else {
      await roleInsert;
    }

    const data: RoleDto = {
      id,
      name: input.name,
      kind: "custom",
      systemKey: null,
      permissions: input.permissions,
      position: null,
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

rolesRoutes.put(
  "/reorder",

  requireAuth,

  requirePermission("roles.manage"),

  zValidator(
    "json",

    reorderRolesSchema,

    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",

              message: "Invalid role order",
            },
          },
          400,
        );
      }
    },
  ),

  async (c) => {
    const auth = c.var.auth;

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const roles = await db
      .select({
        id: workspaceRoles.id,
      })
      .from(workspaceRoles)
      .where(eq(workspaceRoles.workspaceId, auth.workspace.id));

    const existingIds = new Set(roles.map((role) => role.id));

    if (input.roleIds.length !== roles.length || input.roleIds.some((id) => !existingIds.has(id))) {
      return c.json(
        {
          error: {
            code: "ROLE_ORDER_MISMATCH",

            message: "Role order must contain every custom role exactly once",
          },
        },
        409,
      );
    }

    const now = new Date();

    const [firstRoleId, ...remainingRoleIds] = input.roleIds;

    if (firstRoleId) {
      const firstStatement = db
        .update(workspaceRoles)
        .set({
          position: 0,

          updatedAt: now,
        })
        .where(
          and(
            eq(workspaceRoles.id, firstRoleId),

            eq(workspaceRoles.workspaceId, auth.workspace.id),
          ),
        );

      const remainingStatements = remainingRoleIds.map((roleId, index) =>
        db
          .update(workspaceRoles)
          .set({
            position: index + 1,

            updatedAt: now,
          })
          .where(
            and(
              eq(workspaceRoles.id, roleId),

              eq(workspaceRoles.workspaceId, auth.workspace.id),
            ),
          ),
      );

      await db.batch([firstStatement, ...remainingStatements]);
    }

    return c.json({
      data: {
        success: true as const,
      },
    });
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

        position: workspaceRoles.position,

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

    const roleUpdate = db
      .update(workspaceRoles)
      .set({
        name: input.name,
        updatedAt: now,
      })
      .where(and(eq(workspaceRoles.id, roleId), eq(workspaceRoles.workspaceId, auth.workspace.id)));

    const permissionsDelete = db.delete(workspaceRolePermissions).where(eq(workspaceRolePermissions.roleId, roleId));

    if (input.permissions.length > 0) {
      await db.batch([
        roleUpdate,
        permissionsDelete,

        db.insert(workspaceRolePermissions).values(
          input.permissions.map((permissionKey) => ({
            roleId,
            permissionKey,
          })),
        ),
      ]);
    } else {
      await db.batch([roleUpdate, permissionsDelete]);
    }

    /*
     * Daftar izin custom role disunting →
     * pemegang projects.private.view_all bisa
     * bergeser. Sinkronkan akses seluruh forum.
     */
    const accessSyncEvents = await insertForumAccessSyncForWorkspace(db, auth.workspace.id);

    for (const syncEvent of accessSyncEvents) {
      c.executionCtx.waitUntil(
        dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, syncEvent.eventId).catch(() => undefined),
      );
    }

    const data: RoleDto = {
      id: roleId,
      name: input.name,
      kind: "custom",
      systemKey: null,
      position: role.position,
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
