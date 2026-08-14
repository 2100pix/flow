import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createProjectSchema, updateProjectSchema, type ProjectDto } from "../../shared/contracts/projects";
import { addProjectMemberSchema, type ProjectMemberDto } from "../../shared/contracts/members";

import { createDb } from "../db";
import { clients, projectMembers, projects, users, workspaceMembers } from "../db/schema";
import { createId } from "../lib/id";
import { requireAuth, requireRole } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type ProjectsEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const projectsRoutes = new Hono<ProjectsEnv>();
projectsRoutes.get("/", requireAuth, async (c) => {
  const auth = c.var.auth;
  const db = createDb(c.env.flow_db);

  const result = await db
    .select({
      id: projects.id,

      clientId: clients.id,
      clientName: clients.name,

      name: projects.name,
      description: projects.description,
      status: projects.status,
      startDate: projects.startDate,
      dueDate: projects.dueDate,
      discordChannelUrl: projects.discordChannelUrl,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(projects.workspaceId, auth.workspace.id), eq(clients.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt));

  const data: ProjectDto[] = result.map((project) => ({
    id: project.id,

    client: {
      id: project.clientId,
      name: project.clientName,
    },

    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    dueDate: project.dueDate,
    discordChannelUrl: project.discordChannelUrl,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  }));

  return c.json({
    data,
  });
});

projectsRoutes.post(
  "/",
  requireAuth,
  requireRole("owner", "admin"),
  zValidator("json", createProjectSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid project data",
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

    const [client] = await db
      .select({
        id: clients.id,
        name: clients.name,
      })
      .from(clients)
      .where(and(eq(clients.id, input.clientId), eq(clients.workspaceId, auth.workspace.id), eq(clients.status, "active"), isNull(clients.archivedAt)))
      .limit(1);

    if (!client) {
      return c.json(
        {
          error: {
            code: "CLIENT_NOT_AVAILABLE",
            message: "An active client is required",
          },
        },
        400,
      );
    }

    const id = createId("prj");

    const now = new Date();

    await db.insert(projects).values({
      id,

      workspaceId: auth.workspace.id,

      clientId: client.id,

      name: input.name,

      description: input.description ?? null,
      status: "planning",
      startDate: null,
      dueDate: null,
      discordChannelUrl: null,

      createdAt: now,
      updatedAt: now,
    });

    const data: ProjectDto = {
      id,

      client: {
        id: client.id,
        name: client.name,
      },

      name: input.name,
      description: input.description ?? null,
      status: "planning",
      startDate: null,
      dueDate: null,
      discordChannelUrl: null,

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

projectsRoutes.get("/:id", requireAuth, async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

  const db = createDb(c.env.flow_db);

  const [project] = await db
    .select({
      id: projects.id,

      clientId: clients.id,
      clientName: clients.name,

      name: projects.name,
      description: projects.description,
      status: projects.status,
      startDate: projects.startDate,
      dueDate: projects.dueDate,
      discordChannelUrl: projects.discordChannelUrl,

      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), eq(clients.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .limit(1);

  if (!project) {
    return c.json(
      {
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Project not found",
        },
      },
      404,
    );
  }

  const data: ProjectDto = {
    id: project.id,

    client: {
      id: project.clientId,
      name: project.clientName,
    },

    name: project.name,
    description: project.description,
    status: project.status,
    startDate: project.startDate,
    dueDate: project.dueDate,
    discordChannelUrl: project.discordChannelUrl,

    createdAt: project.createdAt.toISOString(),

    updatedAt: project.updatedAt.toISOString(),
  };

  return c.json({
    data,
  });
});

projectsRoutes.patch(
  "/:id",
  requireAuth,
  requireRole("owner", "admin"),
  zValidator("json", updateProjectSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid project data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;
    const projectId = c.req.param("id");

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [project] = await db
      .select({
        id: projects.id,

        clientId: clients.id,
        clientName: clients.name,

        name: projects.name,
        description: projects.description,
        status: projects.status,
        startDate: projects.startDate,
        dueDate: projects.dueDate,
        discordChannelUrl: projects.discordChannelUrl,

        createdAt: projects.createdAt,
      })
      .from(projects)
      .innerJoin(clients, eq(projects.clientId, clients.id))
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), eq(clients.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
      .limit(1);

    if (!project) {
      return c.json(
        {
          error: {
            code: "PROJECT_NOT_FOUND",
            message: "Project not found",
          },
        },
        404,
      );
    }

    let selectedClient = {
      id: project.clientId,
      name: project.clientName,
    };

    if (input.clientId !== undefined && input.clientId !== project.clientId) {
      const [targetClient] = await db
        .select({
          id: clients.id,
          name: clients.name,
        })
        .from(clients)
        .where(and(eq(clients.id, input.clientId), eq(clients.workspaceId, auth.workspace.id), eq(clients.status, "active"), isNull(clients.archivedAt)))
        .limit(1);

      if (!targetClient) {
        return c.json(
          {
            error: {
              code: "CLIENT_NOT_AVAILABLE",
              message: "An active client is required",
            },
          },
          400,
        );
      }

      selectedClient = targetClient;
    }

    const startDate = input.startDate !== undefined ? input.startDate : project.startDate;

    const dueDate = input.dueDate !== undefined ? input.dueDate : project.dueDate;

    if (startDate && dueDate && startDate > dueDate) {
      return c.json(
        {
          error: {
            code: "INVALID_PROJECT_DATES",
            message: "Due date cannot be before start date",
          },
        },
        400,
      );
    }

    const now = new Date();

    const name = input.name ?? project.name;

    const description = input.description !== undefined ? input.description : project.description;

    const status = input.status ?? project.status;

    const discordChannelUrl = input.discordChannelUrl !== undefined ? input.discordChannelUrl : project.discordChannelUrl;

    await db
      .update(projects)
      .set({
        clientId: selectedClient.id,
        name,
        description,
        status,
        startDate,
        dueDate,
        discordChannelUrl,
        updatedAt: now,
      })
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)));

    const data: ProjectDto = {
      id: project.id,

      client: selectedClient,

      name,
      description,
      status,
      startDate,
      dueDate,
      discordChannelUrl,

      createdAt: project.createdAt.toISOString(),

      updatedAt: now.toISOString(),
    };

    return c.json({
      data,
    });
  },
);

projectsRoutes.delete("/:id", requireAuth, requireRole("owner", "admin"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

  const db = createDb(c.env.flow_db);

  const [project] = await db
    .select({
      id: projects.id,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .limit(1);

  if (!project) {
    return c.json(
      {
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Project not found",
        },
      },
      404,
    );
  }

  const now = new Date();

  await db
    .update(projects)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});

/**
 * * bagian member project
 */
projectsRoutes.get("/:id/members", requireAuth, async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

  const db = createDb(c.env.flow_db);

  const [project] = await db
    .select({
      id: projects.id,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .limit(1);

  if (!project) {
    return c.json(
      {
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Project not found",
        },
      },
      404,
    );
  }

  const result = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: workspaceMembers.role,
      addedAt: projectMembers.createdAt,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, auth.workspace.id)))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(users.displayName));

  const data: ProjectMemberDto[] = result.map((member) => ({
    user: {
      id: member.id,
      displayName: member.displayName,
      avatarUrl: member.avatarUrl,
      role: member.role,
    },

    addedAt: member.addedAt.toISOString(),
  }));

  return c.json({
    data,
  });
});

projectsRoutes.post(
  "/:id/members",
  requireAuth,
  requireRole("owner", "admin"),
  zValidator("json", addProjectMemberSchema, (result, c) => {
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
  }),
  async (c) => {
    const auth = c.var.auth;
    const projectId = c.req.param("id");

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [project] = await db
      .select({
        id: projects.id,
      })
      .from(projects)
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
      .limit(1);

    if (!project) {
      return c.json(
        {
          error: {
            code: "PROJECT_NOT_FOUND",
            message: "Project not found",
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
        404,
      );
    }

    const now = new Date();

    await db
      .insert(projectMembers)
      .values({
        projectId,
        userId: member.id,
        createdAt: now,
      })
      .onConflictDoNothing();

    const [membership] = await db
      .select({
        addedAt: projectMembers.createdAt,
      })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, member.id)))
      .limit(1);

    if (!membership) {
      return c.json(
        {
          error: {
            code: "PROJECT_MEMBER_PERSISTENCE_FAILED",
            message: "Failed to add project member",
          },
        },
        500,
      );
    }

    const data: ProjectMemberDto = {
      user: {
        id: member.id,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
        role: member.role,
      },

      addedAt: membership.addedAt.toISOString(),
    };

    return c.json({
      data,
    });
  },
);

projectsRoutes.delete("/:id/members/:userId", requireAuth, requireRole("owner", "admin"), async (c) => {
  const auth = c.var.auth;

  const projectId = c.req.param("id");

  const userId = c.req.param("userId");

  const db = createDb(c.env.flow_db);

  const [project] = await db
    .select({
      id: projects.id,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .limit(1);

  if (!project) {
    return c.json(
      {
        error: {
          code: "PROJECT_NOT_FOUND",
          message: "Project not found",
        },
      },
      404,
    );
  }

  const [membership] = await db
    .select({
      userId: projectMembers.userId,
    })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)))
    .limit(1);

  if (!membership) {
    return c.json(
      {
        error: {
          code: "PROJECT_MEMBER_NOT_FOUND",
          message: "Project member not found",
        },
      },
      404,
    );
  }

  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});
