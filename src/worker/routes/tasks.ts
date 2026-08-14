import { and, asc, eq, isNull, max } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createTaskSchema, type TaskDto } from "../../shared/contracts/tasks";
import { createDb } from "../db";
import { projects, tasks, users } from "../db/schema";
import { createId } from "../lib/id";
import { requireAuth } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type TasksEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const tasksRoutes = new Hono<TasksEnv>();

tasksRoutes.get("/projects/:projectId/tasks", requireAuth, async (c) => {
  const auth = c.var.auth;

  const projectId = c.req.param("projectId");

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
      id: tasks.id,
      projectId: tasks.projectId,

      title: tasks.title,
      description: tasks.description,

      status: tasks.status,
      priority: tasks.priority,

      assigneeId: users.id,
      assigneeDisplayName: users.displayName,
      assigneeAvatarUrl: users.avatarUrl,

      dueDate: tasks.dueDate,
      sortOrder: tasks.sortOrder,

      discordThreadUrl: tasks.discordThreadUrl,

      createdAt: tasks.createdAt,
      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));

  const data: TaskDto[] = result.map((task) => ({
    id: task.id,
    projectId: task.projectId,

    title: task.title,
    description: task.description,

    status: task.status,
    priority: task.priority,

    assignee:
      task.assigneeId && task.assigneeDisplayName
        ? {
            id: task.assigneeId,

            displayName: task.assigneeDisplayName,

            avatarUrl: task.assigneeAvatarUrl,
          }
        : null,

    dueDate: task.dueDate,

    sortOrder: task.sortOrder,

    discordThreadUrl: task.discordThreadUrl,

    createdAt: task.createdAt.toISOString(),

    updatedAt: task.updatedAt.toISOString(),
  }));

  return c.json({
    data,
  });
});

tasksRoutes.post(
  "/projects/:projectId/tasks",
  requireAuth,
  zValidator("json", createTaskSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid task data",
          },
        },
        400,
      );
    }
  }),
  async (c) => {
    const auth = c.var.auth;

    const projectId = c.req.param("projectId");

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

    const status = input.status ?? "backlog";

    const [position] = await db
      .select({
        maxSortOrder: max(tasks.sortOrder),
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status), isNull(tasks.archivedAt)));

    const sortOrder = (position?.maxSortOrder ?? 0) + 100;

    const id = createId("tsk");

    const now = new Date();

    await db.insert(tasks).values({
      id,
      projectId,

      title: input.title,
      description: null,

      status,
      priority: null,

      assigneeId: null,
      dueDate: null,

      sortOrder,

      discordThreadUrl: null,

      createdBy: auth.user.id,

      createdAt: now,
      updatedAt: now,
    });

    const data: TaskDto = {
      id,
      projectId,

      title: input.title,
      description: null,

      status,
      priority: null,

      assignee: null,
      dueDate: null,

      sortOrder,

      discordThreadUrl: null,

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
