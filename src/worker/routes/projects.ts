import { and, desc, eq, isNull } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createProjectSchema, type ProjectDto } from "../../shared/contracts/projects";
import { createDb } from "../db";
import { clients, projects } from "../db/schema";
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

      description: null,
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
      description: null,
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
