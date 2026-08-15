import { and, asc, count, eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { updateWorkspaceMemberRoleSchema, type MemberDto } from "../../shared/contracts/members";
import { createDb } from "../db";
import { users, workspaceMembers, workspaceRoles } from "../db/schema";
import { requireAuth, requireRole } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type MembersEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const membersRoutes = new Hono<MembersEnv>();

membersRoutes.get("/", requireAuth, async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const result = await db
    .select({
      id: users.id,

      displayName: users.displayName,

      avatarUrl: users.avatarUrl,

      role: workspaceMembers.role,

      customRoleId: workspaceRoles.id,

      customRoleName: workspaceRoles.name,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .leftJoin(
      workspaceRoles,
      and(
        eq(workspaceMembers.customRoleId, workspaceRoles.id),

        eq(workspaceRoles.workspaceId, auth.workspace.id),
      ),
    )
    .where(eq(workspaceMembers.workspaceId, auth.workspace.id))
    .orderBy(asc(users.displayName));

  const data: MemberDto[] = result.map((member) => ({
    id: member.id,

    displayName: member.displayName,

    avatarUrl: member.avatarUrl,

    role: member.role,

    customRole:
      member.customRoleId && member.customRoleName
        ? {
            id: member.customRoleId,

            name: member.customRoleName,
          }
        : null,
  }));

  return c.json({
    data,
  });
});

membersRoutes.patch(
  "/:userId/role",
  requireAuth,
  requireRole("owner", "admin"),
  zValidator("json", updateWorkspaceMemberRoleSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",

            message: "Invalid member role data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const userId = c.req.param("userId");

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [targetMember] = await db
      .select({
        userId: workspaceMembers.userId,

        role: workspaceMembers.role,

        customRoleId: workspaceMembers.customRoleId,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspace.id),

          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!targetMember) {
      return c.json(
        {
          error: {
            code: "MEMBER_NOT_FOUND",

            message: "Workspace member not found",
          },
        },
        404,
      );
    }

    if (targetMember.role === "owner" && auth.workspace.role !== "owner") {
      return c.json(
        {
          error: {
            code: "OWNER_REQUIRED",

            message: "Only a workspace owner can change another owner",
          },
        },
        403,
      );
    }

    let nextRole: "owner" | "admin" | "member";

    let nextCustomRoleId: string | null = null;

    let nextCustomRole: {
      id: string;
      name: string;
    } | null = null;

    if (input.kind === "built_in") {
      if (input.role === "owner" && auth.workspace.role !== "owner") {
        return c.json(
          {
            error: {
              code: "OWNER_REQUIRED",

              message: "Only a workspace owner can assign the owner role",
            },
          },
          403,
        );
      }

      nextRole = input.role;

      nextCustomRoleId = null;
    } else {
      const [customRole] = await db
        .select({
          id: workspaceRoles.id,

          name: workspaceRoles.name,
        })
        .from(workspaceRoles)
        .where(
          and(
            eq(workspaceRoles.id, input.roleId),

            eq(workspaceRoles.workspaceId, auth.workspace.id),
          ),
        )
        .limit(1);

      if (!customRole) {
        return c.json(
          {
            error: {
              code: "ROLE_NOT_FOUND",

              message: "Custom role not found",
            },
          },
          404,
        );
      }

      nextRole = "member";

      nextCustomRoleId = customRole.id;

      nextCustomRole = {
        id: customRole.id,

        name: customRole.name,
      };
    }

    if (targetMember.role === "owner" && nextRole !== "owner") {
      const [ownerCount] = await db
        .select({
          value: count(),
        })
        .from(workspaceMembers)
        .where(
          and(
            eq(workspaceMembers.workspaceId, auth.workspace.id),

            eq(workspaceMembers.role, "owner"),
          ),
        );

      if (!ownerCount || ownerCount.value <= 1) {
        return c.json(
          {
            error: {
              code: "LAST_OWNER",

              message: "The last workspace owner cannot be changed",
            },
          },
          409,
        );
      }
    }

    await db
      .update(workspaceMembers)
      .set({
        role: nextRole,

        customRoleId: nextCustomRoleId,
      })
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspace.id),

          eq(workspaceMembers.userId, userId),
        ),
      );

    const [user] = await db
      .select({
        id: users.id,

        displayName: users.displayName,

        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return c.json(
        {
          error: {
            code: "MEMBER_NOT_FOUND",

            message: "Workspace member not found",
          },
        },
        404,
      );
    }

    const data: MemberDto = {
      id: user.id,

      displayName: user.displayName,

      avatarUrl: user.avatarUrl,

      role: nextRole,

      customRole: nextCustomRole,
    };

    return c.json({
      data,
    });
  },
);
