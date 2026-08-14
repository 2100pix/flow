import { and, asc, eq, inArray, isNull, max, sql, type SQL } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createTaskSchema, reorderTasksSchema, updateTaskSchema, type TaskDto } from "../../shared/contracts/tasks";
import { createDb } from "../db";
import { projectMembers, projects, tasks, users, workspaceMembers } from "../db/schema";
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

tasksRoutes.patch(
  "/projects/:projectId/tasks/reorder",
  requireAuth,
  zValidator("json", reorderTasksSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid task order",
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

    const statuses = input.columns.map((column) => column.status);

    const receivedIds = input.columns.flatMap((column) => column.taskIds);

    const currentTasks = await db
      .select({
        id: tasks.id,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), inArray(tasks.status, statuses), isNull(tasks.archivedAt)));

    const currentIds = new Set(currentTasks.map((task) => task.id));

    if (currentIds.size !== receivedIds.length || receivedIds.some((taskId) => !currentIds.has(taskId))) {
      return c.json(
        {
          error: {
            code: "BOARD_CHANGED",
            message: "Task board changed; reload and try again",
          },
        },
        409,
      );
    }

    if (receivedIds.length === 0) {
      return c.json({
        data: {
          success: true as const,
        },
      });
    }

    const statusCase: SQL[] = [sql`(case`];

    const sortOrderCase: SQL[] = [sql`(case`];

    for (const column of input.columns) {
      column.taskIds.forEach((taskId, index) => {
        statusCase.push(sql`when ${tasks.id} = ${taskId} then ${column.status}`);

        sortOrderCase.push(sql`when ${tasks.id} = ${taskId} then ${(index + 1) * 100}`);
      });
    }

    statusCase.push(sql`else ${tasks.status} end)`);

    sortOrderCase.push(sql`else ${tasks.sortOrder} end)`);

    const nextStatus = sql.join(statusCase, sql.raw(" "));

    const nextSortOrder = sql.join(sortOrderCase, sql.raw(" "));

    const now = new Date();

    await db
      .update(tasks)
      .set({
        status: nextStatus,
        sortOrder: nextSortOrder,
        updatedAt: now,
      })
      .where(and(eq(tasks.projectId, projectId), inArray(tasks.id, receivedIds), isNull(tasks.archivedAt)));

    return c.json({
      data: {
        success: true as const,
      },
    });
  },
);

tasksRoutes.get("/tasks/:taskId", requireAuth, async (c) => {
  const auth = c.var.auth;

  const taskId = c.req.param("taskId");

  const db = createDb(c.env.flow_db);

  const [task] = await db
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
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .leftJoin(users, eq(tasks.assigneeId, users.id))
    .where(and(eq(tasks.id, taskId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt), isNull(tasks.archivedAt)))
    .limit(1);

  if (!task) {
    return c.json(
      {
        error: {
          code: "TASK_NOT_FOUND",
          message: "Task not found",
        },
      },
      404,
    );
  }

  const data: TaskDto = {
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
  };

  return c.json({
    data,
  });
});

tasksRoutes.patch(
  "/tasks/:taskId",
  requireAuth,
  zValidator("json", updateTaskSchema, (result, c) => {
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

    const taskId = c.req.param("taskId");

    const input = c.req.valid("json");

    const db = createDb(c.env.flow_db);

    const [task] = await db
      .select({
        id: tasks.id,
        projectId: tasks.projectId,

        title: tasks.title,
        description: tasks.description,

        status: tasks.status,
        priority: tasks.priority,

        assigneeId: tasks.assigneeId,

        dueDate: tasks.dueDate,

        sortOrder: tasks.sortOrder,

        discordThreadUrl: tasks.discordThreadUrl,

        createdAt: tasks.createdAt,
      })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(and(eq(tasks.id, taskId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt), isNull(tasks.archivedAt)))
      .limit(1);

    if (!task) {
      return c.json(
        {
          error: {
            code: "TASK_NOT_FOUND",
            message: "Task not found",
          },
        },
        404,
      );
    }

    let assignee: TaskDto["assignee"] = null;

    const assigneeId = input.assigneeId !== undefined ? input.assigneeId : task.assigneeId;

    if (assigneeId) {
      const [member] = await db
        .select({
          id: users.id,
          displayName: users.displayName,
          avatarUrl: users.avatarUrl,
        })
        .from(projectMembers)
        .innerJoin(users, eq(projectMembers.userId, users.id))
        .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, auth.workspace.id)))
        .where(and(eq(projectMembers.projectId, task.projectId), eq(projectMembers.userId, assigneeId)))
        .limit(1);

      if (!member) {
        return c.json(
          {
            error: {
              code: "ASSIGNEE_NOT_AVAILABLE",
              message: "Assignee must be a project member",
            },
          },
          400,
        );
      }

      assignee = {
        id: member.id,
        displayName: member.displayName,
        avatarUrl: member.avatarUrl,
      };
    }

    const status = input.status ?? task.status;

    let sortOrder = task.sortOrder;

    if (status !== task.status) {
      const [position] = await db
        .select({
          maxSortOrder: max(tasks.sortOrder),
        })
        .from(tasks)
        .where(and(eq(tasks.projectId, task.projectId), eq(tasks.status, status), isNull(tasks.archivedAt)));

      sortOrder = (position?.maxSortOrder ?? 0) + 100;
    }

    const title = input.title ?? task.title;

    const description = input.description !== undefined ? input.description : task.description;

    const priority = input.priority !== undefined ? input.priority : task.priority;

    const dueDate = input.dueDate !== undefined ? input.dueDate : task.dueDate;

    const discordThreadUrl = input.discordThreadUrl !== undefined ? input.discordThreadUrl : task.discordThreadUrl;

    const now = new Date();

    await db
      .update(tasks)
      .set({
        title,
        description,
        status,
        priority,
        assigneeId,
        dueDate,
        sortOrder,
        discordThreadUrl,
        updatedAt: now,
      })
      .where(and(eq(tasks.id, taskId), eq(tasks.projectId, task.projectId), isNull(tasks.archivedAt)));

    const data: TaskDto = {
      id: task.id,
      projectId: task.projectId,

      title,
      description,
      status,
      priority,
      assignee,
      dueDate,
      sortOrder,
      discordThreadUrl,

      createdAt: task.createdAt.toISOString(),

      updatedAt: now.toISOString(),
    };

    return c.json({
      data,
    });
  },
);

tasksRoutes.delete("/tasks/:taskId", requireAuth, async (c) => {
  const auth = c.var.auth;

  const taskId = c.req.param("taskId");

  const db = createDb(c.env.flow_db);

  const [task] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, taskId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt), isNull(tasks.archivedAt)))
    .limit(1);

  if (!task) {
    return c.json(
      {
        error: {
          code: "TASK_NOT_FOUND",
          message: "Task not found",
        },
      },
      404,
    );
  }

  const now = new Date();

  await db
    .update(tasks)
    .set({
      archivedAt: now,
      updatedAt: now,
    })
    .where(and(eq(tasks.id, task.id), eq(tasks.projectId, task.projectId), isNull(tasks.archivedAt)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});
