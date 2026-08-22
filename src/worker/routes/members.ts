import { and, asc, count, eq, inArray } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { updateWorkspaceMemberRoleSchema, updateWorkspaceMemberSchema, createWorkspaceExpertiseSchema, updateMemberExpertiseSchema, type WorkspaceExpertiseDto, type MemberAccessRequestDto, type MemberDto } from "../../shared/contracts/members";
import { createDb } from "../db";
import { createId } from "../lib/id";
import {
  projectLeads,
  projectMembers,
  projects,
  sessions,
  taskAssignees,
  tasks,
  teamMembers,
  teams,
  users,
  workspaceAccessRequests,
  workspaceMembers,
  workspaceRolePermissions,
  workspaceRoles,
  memberExpertise,
  workspaceExpertise,
} from "../db/schema";
import { requireAuth, requirePermission } from "../middleware/auth";
import { permissionKeySchema } from "../../shared/permissions";

import { builtInRoleDefinitions } from "../../shared/roles";

import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

async function isWorkspaceCreator(db: ReturnType<typeof createDb>, env: AppBindings, userId: string) {
  const [user] = await db
    .select({
      discordUserId: users.discordUserId,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user?.discordUserId === env.FLOW_BOOTSTRAP_OWNER_DISCORD_USER_ID;
}

type MembersEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const membersRoutes = new Hono<MembersEnv>();

membersRoutes.get("/", requireAuth, requirePermission("members.view"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const result = await db
    .select({
      id: users.id,

      displayName: users.displayName,

      avatarUrl: users.avatarUrl,

      role: workspaceMembers.role,

      joinedAt: workspaceMembers.createdAt,

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

  const expertiseRows = await db
    .select({
      userId: memberExpertise.userId,

      id: workspaceExpertise.id,

      name: workspaceExpertise.name,

      createdAt: workspaceExpertise.createdAt,
    })
    .from(memberExpertise)
    .innerJoin(workspaceExpertise, eq(memberExpertise.expertiseId, workspaceExpertise.id))
    .where(eq(workspaceExpertise.workspaceId, auth.workspace.id))
    .orderBy(asc(workspaceExpertise.name));

  const expertiseByUserId = new Map<string, MemberDto["expertise"]>();

  for (const expertise of expertiseRows) {
    const current = expertiseByUserId.get(expertise.userId) ?? [];

    current.push({
      id: expertise.id,

      name: expertise.name,

      createdAt: expertise.createdAt.toISOString(),
    });

    expertiseByUserId.set(expertise.userId, current);
  }
  const data: MemberDto[] = result.map((member) => ({
    id: member.id,

    displayName: member.displayName,

    avatarUrl: member.avatarUrl,

    role: member.role,

    joinedAt: member.joinedAt.toISOString(),
    expertise: expertiseByUserId.get(member.id) ?? [],
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

membersRoutes.get("/access-requests", requireAuth, requirePermission("members.manage"), async (c) => {
  const auth = c.var.auth;
  const db = createDb(c.env.flow_db);

  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      requestedAt: workspaceAccessRequests.requestedAt,
    })
    .from(workspaceAccessRequests)
    .innerJoin(users, eq(workspaceAccessRequests.userId, users.id))
    .where(eq(workspaceAccessRequests.workspaceId, auth.workspace.id))
    .orderBy(asc(workspaceAccessRequests.requestedAt));

  const data: MemberAccessRequestDto[] = rows.map((request) => ({
    id: request.id,
    displayName: request.displayName,
    avatarUrl: request.avatarUrl,
    requestedAt: request.requestedAt.toISOString(),
  }));

  return c.json({
    data,
  });
});

membersRoutes.post("/access-requests/:userId/approve", requireAuth, requirePermission("members.manage"), async (c) => {
  const auth = c.var.auth;
  const userId = c.req.param("userId");
  const db = createDb(c.env.flow_db);

  const [request] = await db
    .select({
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(workspaceAccessRequests)
    .innerJoin(users, eq(workspaceAccessRequests.userId, users.id))
    .where(and(eq(workspaceAccessRequests.workspaceId, auth.workspace.id), eq(workspaceAccessRequests.userId, userId)))
    .limit(1);

  if (!request) {
    return c.json(
      {
        error: {
          code: "ACCESS_REQUEST_NOT_FOUND",
          message: "Access request not found",
        },
      },
      404,
    );
  }

  const [existingMember] = await db
    .select({
      userId: workspaceMembers.userId,
    })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, auth.workspace.id), eq(workspaceMembers.userId, userId)))
    .limit(1);

  if (existingMember) {
    return c.json(
      {
        error: {
          code: "MEMBER_ALREADY_EXISTS",
          message: "User is already a workspace member",
        },
      },
      409,
    );
  }

  const now = new Date();

  await db.batch([
    db.insert(workspaceMembers).values({
      workspaceId: auth.workspace.id,
      userId,
      role: "member",
      customRoleId: null,
      createdAt: now,
    }),

    db.delete(workspaceAccessRequests).where(and(eq(workspaceAccessRequests.workspaceId, auth.workspace.id), eq(workspaceAccessRequests.userId, userId))),
  ]);

  const data: MemberDto = {
    id: request.userId,
    displayName: request.displayName,
    avatarUrl: request.avatarUrl,
    role: "member",
    customRole: null,
  };

  return c.json({
    data,
  });
});

membersRoutes.delete("/access-requests/:userId", requireAuth, requirePermission("members.manage"), async (c) => {
  const auth = c.var.auth;
  const userId = c.req.param("userId");
  const db = createDb(c.env.flow_db);

  const [request] = await db
    .select({
      userId: workspaceAccessRequests.userId,
    })
    .from(workspaceAccessRequests)
    .where(and(eq(workspaceAccessRequests.workspaceId, auth.workspace.id), eq(workspaceAccessRequests.userId, userId)))
    .limit(1);

  if (!request) {
    return c.json(
      {
        error: {
          code: "ACCESS_REQUEST_NOT_FOUND",
          message: "Access request not found",
        },
      },
      404,
    );
  }

  await db.delete(workspaceAccessRequests).where(and(eq(workspaceAccessRequests.workspaceId, auth.workspace.id), eq(workspaceAccessRequests.userId, userId)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});

membersRoutes.get(
  "/expertise",

  requireAuth,

  requirePermission("members.view"),

  async (c) => {
    const auth = c.var.auth;

    const db = createDb(c.env.flow_db);

    const rows = await db
      .select({
        id: workspaceExpertise.id,

        name: workspaceExpertise.name,

        createdAt: workspaceExpertise.createdAt,
      })
      .from(workspaceExpertise)
      .where(eq(workspaceExpertise.workspaceId, auth.workspace.id))
      .orderBy(asc(workspaceExpertise.name));

    const data: WorkspaceExpertiseDto[] = rows.map((row) => ({
      id: row.id,

      name: row.name,

      createdAt: row.createdAt.toISOString(),
    }));

    return c.json({
      data,
    });
  },
);

membersRoutes.post(
  "/expertise",

  requireAuth,

  requirePermission("members.manage"),

  zValidator(
    "json",

    createWorkspaceExpertiseSchema,

    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",

              message: "Invalid expertise data",
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

    const existing = await db
      .select({
        id: workspaceExpertise.id,

        name: workspaceExpertise.name,
      })
      .from(workspaceExpertise)
      .where(eq(workspaceExpertise.workspaceId, auth.workspace.id));

    const duplicate = existing.some((expertise) => expertise.name.trim().toLowerCase() === input.name.trim().toLowerCase());

    if (duplicate) {
      return c.json(
        {
          error: {
            code: "EXPERTISE_NAME_TAKEN",

            message: "Expertise already exists",
          },
        },
        409,
      );
    }

    const id = createId("exp");

    const now = new Date();

    await db.insert(workspaceExpertise).values({
      id,

      workspaceId: auth.workspace.id,

      name: input.name,

      createdAt: now,

      updatedAt: now,
    });

    const data: WorkspaceExpertiseDto = {
      id,

      name: input.name,

      createdAt: now.toISOString(),
    };

    return c.json(
      {
        data,
      },
      201,
    );
  },
);
membersRoutes.put(
  "/:userId/expertise",

  requireAuth,

  requirePermission("members.manage"),

  zValidator(
    "json",

    updateMemberExpertiseSchema,

    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",

              message: "Invalid member expertise",
            },
          },
          400,
        );
      }
    },
  ),

  async (c) => {
    const auth = c.var.auth;

    const userId = c.req.param("userId");

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [membership] = await db
      .select({
        userId: workspaceMembers.userId,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspace.id),

          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
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

    const available = await db
      .select({
        id: workspaceExpertise.id,
      })
      .from(workspaceExpertise)
      .where(eq(workspaceExpertise.workspaceId, auth.workspace.id));

    const availableIds = new Set(available.map((item) => item.id));

    if (input.expertiseIds.some((id) => !availableIds.has(id))) {
      return c.json(
        {
          error: {
            code: "EXPERTISE_NOT_AVAILABLE",

            message: "Expertise is not available in this workspace",
          },
        },
        400,
      );
    }

    const workspaceExpertiseIds = [...availableIds];

    const deletes =
      workspaceExpertiseIds.length > 0
        ? db.delete(memberExpertise).where(
            and(
              eq(memberExpertise.userId, userId),

              inArray(memberExpertise.expertiseId, workspaceExpertiseIds),
            ),
          )
        : null;

    const now = new Date();

    if (input.expertiseIds.length > 0) {
      const insert = db.insert(memberExpertise).values(
        input.expertiseIds.map((expertiseId) => ({
          userId,

          expertiseId,

          createdAt: now,
        })),
      );

      if (deletes) {
        await db.batch([deletes, insert]);
      } else {
        await insert;
      }
    } else if (deletes) {
      await deletes;
    }

    return c.json({
      data: {
        success: true as const,
      },
    });
  },
);

membersRoutes.patch(
  "/:userId",

  requireAuth,

  requirePermission("members.manage"),

  zValidator(
    "json",

    updateWorkspaceMemberSchema,

    (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: {
              code: "VALIDATION_ERROR",

              message: "Invalid member data",
            },
          },
          400,
        );
      }
    },
  ),

  async (c) => {
    const auth = c.var.auth;

    const userId = c.req.param("userId");

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [membership] = await db
      .select({
        role: workspaceMembers.role,

        customRoleId: workspaceMembers.customRoleId,

        customRoleName: workspaceRoles.name,

        joinedAt: workspaceMembers.createdAt,

        avatarUrl: users.avatarUrl,
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
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspace.id),

          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!membership) {
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

    const now = new Date();

    await db
      .update(users)
      .set({
        displayName: input.displayName,

        updatedAt: now,
      })
      .where(eq(users.id, userId));

    const data: MemberDto = {
      id: userId,

      displayName: input.displayName,

      avatarUrl: membership.avatarUrl,

      role: membership.role,

      customRole:
        membership.customRoleId && membership.customRoleName
          ? {
              id: membership.customRoleId,

              name: membership.customRoleName,
            }
          : null,

      joinedAt: membership.joinedAt.toISOString(),
    };

    return c.json({
      data,
    });
  },
);

membersRoutes.delete(
  "/:userId",

  requireAuth,

  requirePermission("members.manage"),

  async (c) => {
    const auth = c.var.auth;
    const userId = c.req.param("userId");
    const db = createDb(c.env.flow_db);

    const callerIsWorkspaceCreator = await isWorkspaceCreator(db, c.env, auth.user.id);
    const targetIsWorkspaceCreator = await isWorkspaceCreator(db, c.env, userId);

    if (targetIsWorkspaceCreator) {
      return c.json(
        {
          error: {
            code: "WORKSPACE_CREATOR_PROTECTED",

            message: "The workspace creator cannot be removed",
          },
        },
        409,
      );
    }

    if (userId === auth.user.id) {
      return c.json(
        {
          error: {
            code: "SELF_REMOVE_NOT_ALLOWED",

            message: "You cannot remove yourself from the workspace",
          },
        },
        409,
      );
    }

    const [target] = await db
      .select({
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, auth.workspace.id),

          eq(workspaceMembers.userId, userId),
        ),
      )
      .limit(1);

    if (!target) {
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

    const callerIsAdmin = auth.workspace.role === "owner" || auth.workspace.role === "admin";

    if ((target.role === "owner" || target.role === "admin") && !callerIsAdmin) {
      return c.json(
        {
          error: {
            code: "SYSTEM_ROLE_PROTECTED",

            message: "You cannot remove a system administrator",
          },
        },
        403,
      );
    }

    if (target.role === "owner" && !callerIsWorkspaceCreator) {
      return c.json(
        {
          error: {
            code: "OWNER_REQUIRED",

            message: "Only a workspace owner can remove another owner",
          },
        },
        403,
      );
    }

    if (target.role === "owner") {
      const [owners] = await db
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

      if (!owners || owners.value <= 1) {
        return c.json(
          {
            error: {
              code: "LAST_OWNER",

              message: "The last workspace owner cannot be removed",
            },
          },
          409,
        );
      }
    }

    const projectRows = await db
      .select({
        id: projects.id,
      })
      .from(projects)
      .where(eq(projects.workspaceId, auth.workspace.id));

    const projectIds = projectRows.map((project) => project.id);

    const teamRows = await db
      .select({
        id: teams.id,
      })
      .from(teams)
      .where(eq(teams.workspaceId, auth.workspace.id));

    const teamIds = teamRows.map((team) => team.id);

    if (projectIds.length > 0) {
      const taskRows = await db
        .select({
          id: tasks.id,
        })
        .from(tasks)
        .where(inArray(tasks.projectId, projectIds));

      const taskIds = taskRows.map((task) => task.id);

      await db.delete(projectLeads).where(
        and(
          eq(projectLeads.userId, userId),

          inArray(projectLeads.projectId, projectIds),
        ),
      );

      await db.delete(projectMembers).where(
        and(
          eq(projectMembers.userId, userId),

          inArray(projectMembers.projectId, projectIds),
        ),
      );

      await db
        .update(projects)
        .set({
          leadUserId: null,
        })
        .where(
          and(
            eq(projects.workspaceId, auth.workspace.id),

            eq(projects.leadUserId, userId),
          ),
        );

      await db
        .update(tasks)
        .set({
          leadUserId: null,
        })
        .where(
          and(
            inArray(tasks.projectId, projectIds),

            eq(tasks.leadUserId, userId),
          ),
        );

      await db
        .update(tasks)
        .set({
          assigneeId: null,
        })
        .where(
          and(
            inArray(tasks.projectId, projectIds),

            eq(tasks.assigneeId, userId),
          ),
        );

      if (taskIds.length > 0) {
        await db.delete(taskAssignees).where(
          and(
            eq(taskAssignees.userId, userId),

            inArray(taskAssignees.taskId, taskIds),
          ),
        );
      }
    }

    if (teamIds.length > 0) {
      await db.delete(teamMembers).where(
        and(
          eq(teamMembers.userId, userId),

          inArray(teamMembers.teamId, teamIds),
        ),
      );
    }

    await db.delete(workspaceMembers).where(
      and(
        eq(workspaceMembers.workspaceId, auth.workspace.id),

        eq(workspaceMembers.userId, userId),
      ),
    );

    await db.delete(sessions).where(eq(sessions.userId, userId));

    return c.json({
      data: {
        success: true as const,
      },
    });
  },
);

membersRoutes.patch(
  "/:userId/role",
  requireAuth,
  requirePermission("members.manage"),
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
    const callerIsWorkspaceCreator = await isWorkspaceCreator(db, c.env, auth.user.id);
    const targetIsWorkspaceCreator = await isWorkspaceCreator(db, c.env, userId);

    if (targetIsWorkspaceCreator && input.kind === "built_in" && input.role !== "owner") {
      return c.json(
        {
          error: {
            code: "WORKSPACE_CREATOR_OWNER_PROTECTED",

            message: "The workspace creator must remain an Owner",
          },
        },
        409,
      );
    }
    if (targetMember.role === "owner" && input.kind === "built_in" && input.role !== "owner" && !callerIsWorkspaceCreator) {
      return c.json(
        {
          error: {
            code: "WORKSPACE_CREATOR_REQUIRED",

            message: "Only the workspace creator can remove Owner access",
          },
        },
        403,
      );
    }
    if (input.kind === "built_in" && input.role === "owner" && !callerIsWorkspaceCreator) {
      return c.json(
        {
          error: {
            code: "WORKSPACE_CREATOR_REQUIRED",

            message: "Only the workspace creator can assign Owner",
          },
        },
        403,
      );
    }

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
    if ((targetMember.role === "owner" || targetMember.role === "admin") && !isSystemAdministrator) {
      return c.json(
        {
          error: {
            code: "SYSTEM_ROLE_PROTECTED",
            message: "You cannot change a system administrator",
          },
        },
        403,
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
      if (input.role === "owner" && !isSystemOwner) {
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

      if (input.role === "admin" && !isSystemAdministrator) {
        return c.json(
          {
            error: {
              code: "ADMIN_REQUIRED",
              message: "You cannot assign the admin role",
            },
          },
          403,
        );
      }
      const definition = builtInRoleDefinitions.find((role) => role.key === input.role);

      if (!definition) {
        return c.json(
          {
            error: {
              code: "INVALID_ROLE",
              message: "Role is invalid",
            },
          },
          400,
        );
      }

      if (!isSystemAdministrator) {
        const allowed = new Set(auth.workspace.permissions);

        const exceedsCaller = definition.permissions.some((permission) => !allowed.has(permission));

        if (exceedsCaller) {
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
      }
      nextRole = input.role;

      nextCustomRoleId = null;
    } else {
      const customRoleRows = await db
        .select({
          id: workspaceRoles.id,

          name: workspaceRoles.name,

          permissionKey: workspaceRolePermissions.permissionKey,
        })
        .from(workspaceRoles)
        .leftJoin(workspaceRolePermissions, eq(workspaceRolePermissions.roleId, workspaceRoles.id))
        .where(and(eq(workspaceRoles.id, input.roleId), eq(workspaceRoles.workspaceId, auth.workspace.id)));

      if (customRoleRows.length === 0) {
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

      const customRole = {
        id: customRoleRows[0].id,
        name: customRoleRows[0].name,
      };

      const customRolePermissions = customRoleRows.flatMap((row) => {
        const parsed = permissionKeySchema.safeParse(row.permissionKey);

        return parsed.success ? [parsed.data] : [];
      });

      if (!isSystemAdministrator) {
        const allowed = new Set(auth.workspace.permissions);

        const exceedsCaller = customRolePermissions.some((permission) => !allowed.has(permission));

        if (exceedsCaller) {
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
      }

      nextRole = targetMember.role === "owner" ? "owner" : "member";

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
