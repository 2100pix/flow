import { and, asc, eq } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { addTeamMemberSchema, createTeamSchema, updateTeamSchema, type TeamDto } from "../../shared/contracts/teams";
import { createDb } from "../db";
import { teamMembers, teams, users, workspaceMembers, workspaceRoles } from "../db/schema";
import { createId } from "../lib/id";
import { requireAuth, requirePermission } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type TeamsEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const teamsRoutes = new Hono<TeamsEnv>();

teamsRoutes.get("/", requireAuth, requirePermission("teams.view"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const teamRows = await db
    .select({
      id: teams.id,
      name: teams.name,
      createdAt: teams.createdAt,
      updatedAt: teams.updatedAt,
    })
    .from(teams)
    .where(eq(teams.workspaceId, auth.workspace.id))
    .orderBy(asc(teams.name));

  const memberRows = await db
    .select({
      teamId: teamMembers.teamId,
      userId: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: workspaceMembers.role,
      customRoleId: workspaceRoles.id,
      customRoleName: workspaceRoles.name,
      addedAt: teamMembers.createdAt,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .innerJoin(users, eq(teamMembers.userId, users.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, auth.workspace.id)))
    .leftJoin(workspaceRoles, and(eq(workspaceMembers.customRoleId, workspaceRoles.id), eq(workspaceRoles.workspaceId, auth.workspace.id)))
    .where(eq(teams.workspaceId, auth.workspace.id));

  const data: TeamDto[] = teamRows.map((team) => ({
    id: team.id,
    name: team.name,

    members: memberRows
      .filter((member) => member.teamId === team.id)
      .map((member) => ({
        user: {
          id: member.userId,
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
        },

        addedAt: member.addedAt.toISOString(),
      })),

    createdAt: team.createdAt.toISOString(),

    updatedAt: team.updatedAt.toISOString(),
  }));

  return c.json({
    data,
  });
});

teamsRoutes.post(
  "/",
  requireAuth,
  requirePermission("teams.manage"),
  zValidator("json", createTeamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid team data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const id = createId("team");

    const now = new Date();

    await db.insert(teams).values({
      id,

      workspaceId: auth.workspace.id,

      name: input.name,

      createdAt: now,
      updatedAt: now,
    });

    const data: TeamDto = {
      id,
      name: input.name,
      members: [],
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

teamsRoutes.patch(
  "/:teamId",
  requireAuth,
  requirePermission("teams.manage"),
  zValidator("json", updateTeamSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid team data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const teamId = c.req.param("teamId");

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [team] = await db
      .select({
        id: teams.id,
        createdAt: teams.createdAt,
      })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.workspaceId, auth.workspace.id)))
      .limit(1);

    if (!team) {
      return c.json(
        {
          error: {
            code: "TEAM_NOT_FOUND",
            message: "Team not found",
          },
        },
        404,
      );
    }

    const now = new Date();

    await db
      .update(teams)
      .set({
        name: input.name,
        updatedAt: now,
      })
      .where(and(eq(teams.id, teamId), eq(teams.workspaceId, auth.workspace.id)));

    const memberRows = await db
      .select({
        userId: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: workspaceMembers.role,
        customRoleId: workspaceRoles.id,
        customRoleName: workspaceRoles.name,
        addedAt: teamMembers.createdAt,
      })
      .from(teamMembers)
      .innerJoin(users, eq(teamMembers.userId, users.id))
      .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, auth.workspace.id)))
      .leftJoin(workspaceRoles, and(eq(workspaceMembers.customRoleId, workspaceRoles.id), eq(workspaceRoles.workspaceId, auth.workspace.id)))
      .where(eq(teamMembers.teamId, teamId));

    const data: TeamDto = {
      id: teamId,
      name: input.name,

      members: memberRows.map((member) => ({
        user: {
          id: member.userId,
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
        },

        addedAt: member.addedAt.toISOString(),
      })),

      createdAt: team.createdAt.toISOString(),

      updatedAt: now.toISOString(),
    };

    return c.json({
      data,
    });
  },
);

teamsRoutes.delete("/:teamId", requireAuth, requirePermission("teams.manage"), async (c) => {
  const auth = c.var.auth;

  const teamId = c.req.param("teamId");

  const db = createDb(c.env.flow_db);

  const [team] = await db
    .select({
      id: teams.id,
    })
    .from(teams)
    .where(and(eq(teams.id, teamId), eq(teams.workspaceId, auth.workspace.id)))
    .limit(1);

  if (!team) {
    return c.json(
      {
        error: {
          code: "TEAM_NOT_FOUND",
          message: "Team not found",
        },
      },
      404,
    );
  }

  await db.delete(teams).where(and(eq(teams.id, teamId), eq(teams.workspaceId, auth.workspace.id)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});

teamsRoutes.post(
  "/:teamId/members",
  requireAuth,
  requirePermission("teams.manage"),
  zValidator("json", addTeamMemberSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid team member data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const teamId = c.req.param("teamId");

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [team] = await db
      .select({
        id: teams.id,
      })
      .from(teams)
      .where(and(eq(teams.id, teamId), eq(teams.workspaceId, auth.workspace.id)))
      .limit(1);

    if (!team) {
      return c.json(
        {
          error: {
            code: "TEAM_NOT_FOUND",
            message: "Team not found",
          },
        },
        404,
      );
    }

    const [member] = await db
      .select({
        id: users.id,
        displayName: users.displayName,
        avatarUrl: users.avatarUrl,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(and(eq(workspaceMembers.workspaceId, auth.workspace.id), eq(workspaceMembers.userId, input.userId)))
      .limit(1);

    if (!member) {
      return c.json(
        {
          error: {
            code: "MEMBER_NOT_FOUND",
            message: "Workspace member not found",
          },
        },
        400,
      );
    }

    const now = new Date();

    await db
      .insert(teamMembers)
      .values({
        teamId,
        userId: input.userId,
        createdAt: now,
      })
      .onConflictDoNothing();

    return c.json(
      {
        data: {
          user: member,

          addedAt: now.toISOString(),
        },
      },
      201,
    );
  },
);

teamsRoutes.delete("/:teamId/members/:userId", requireAuth, requirePermission("teams.manage"), async (c) => {
  const auth = c.var.auth;

  const teamId = c.req.param("teamId");

  const userId = c.req.param("userId");

  const db = createDb(c.env.flow_db);

  const [membership] = await db
    .select({
      teamId: teamMembers.teamId,
    })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId), eq(teams.workspaceId, auth.workspace.id)))
    .limit(1);

  if (!membership) {
    return c.json(
      {
        error: {
          code: "TEAM_MEMBER_NOT_FOUND",
          message: "Team member not found",
        },
      },
      404,
    );
  }

  await db.delete(teamMembers).where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});
