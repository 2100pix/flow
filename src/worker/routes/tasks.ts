import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { Hono } from "hono";

import { createTaskSchema, reorderTasksSchema, updateTaskSchema, type TaskDto } from "../../shared/contracts/tasks";
import { defaultTaskWorkflowStatuses, updateTaskWorkflowSchema, type TaskWorkflowStatusDto } from "../../shared/contracts/task-workflow";
import { createDb } from "../db";
import { projectMembers, projectTaskStatuses, projects, tasks, users, workspaceMembers } from "../db/schema";
import { createId } from "../lib/id";
import { findAccessibleProject } from "../lib/project-access";
import { hasPermission, requireAuth, requirePermission } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type TasksEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const tasksRoutes = new Hono<TasksEnv>();

type Db = ReturnType<typeof createDb>;

async function loadTaskWorkflow(db: Db, projectId: string): Promise<TaskWorkflowStatusDto[] | null> {
  const result = await db
    .select({
      statusKey: projectTaskStatuses.statusKey,
      label: projectTaskStatuses.label,
      position: projectTaskStatuses.position,
      enabled: projectTaskStatuses.enabled,
    })
    .from(projectTaskStatuses)
    .where(eq(projectTaskStatuses.projectId, projectId))
    .orderBy(asc(projectTaskStatuses.position));

  const statuses: TaskWorkflowStatusDto[] = result.map((status) => ({
    statusKey: status.statusKey,
    label: status.label,
    position: status.position,
    enabled: status.enabled,
  }));

  if (statuses.length !== defaultTaskWorkflowStatuses.length) {
    return null;
  }

  if (statuses.some((status, index) => status.position !== index)) {
    return null;
  }

  const valid = updateTaskWorkflowSchema.safeParse({
    statuses: statuses.map(({ statusKey, label, enabled }) => ({
      statusKey,
      label,
      enabled,
    })),
  }).success;

  return valid ? statuses : null;
}

tasksRoutes.get("/projects/:projectId/tasks", requireAuth, requirePermission("tasks.view"), async (c) => {
  const auth = c.var.auth;

  const projectId = c.req.param("projectId");

  const db = createDb(c.env.flow_db);

  const access = await findAccessibleProject(db, auth, projectId);

  if (!access) {
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

tasksRoutes.post("/projects/:projectId/tasks", requireAuth, requirePermission("tasks.create"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("projectId");
  const db = createDb(c.env.flow_db);
  const access = await findAccessibleProject(db, auth, projectId);

  if (!access) {
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

  const body = await c.req.json().catch(() => undefined);
  const parsed = createTaskSchema.safeParse(body);

  if (!parsed.success) {
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

  const input = parsed.data;
  const workflow = await loadTaskWorkflow(db, projectId);

  if (!workflow) {
    return c.json(
      {
        error: {
          code: "WORKFLOW_INTEGRITY_ERROR",
          message: "Project task workflow is invalid",
        },
      },
      500,
    );
  }

  const status = input.status ?? "backlog";
  const workflowStatus = workflow.find((item) => item.statusKey === status);

  if (!workflowStatus?.enabled) {
    return c.json(
      {
        error: {
          code: "TASK_STATUS_DISABLED",
          message: "Task status is disabled for this project",
        },
      },
      400,
    );
  }
  const [numberPosition] = await db
    .select({
      maxTaskNumber: max(tasks.taskNumber),
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  const taskNumber = (numberPosition?.maxTaskNumber ?? 0) + 1;

  const [position] = await db
    .select({
      maxSortOrder: max(tasks.sortOrder),
    })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), eq(tasks.status, status), isNull(tasks.archivedAt)));

  const sortOrder = (position?.maxSortOrder ?? 0) + 100;
  const id = createId("tsk");
  const now = new Date();
  const startDate = now.toISOString().slice(0, 10);
  await db.insert(tasks).values({
    id,
    projectId,
    taskNumber,
    title: input.title,
    description: null,

    status,
    priority: null,

    assigneeId: null,
    startDate,
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
});

tasksRoutes.patch("/projects/:projectId/tasks/reorder", requireAuth, requirePermission("tasks.edit"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("projectId");
  const db = createDb(c.env.flow_db);
  const access = await findAccessibleProject(db, auth, projectId);

  if (!access) {
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

  const body = await c.req.json().catch(() => undefined);
  const parsed = reorderTasksSchema.safeParse(body);

  if (!parsed.success) {
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

  const input = parsed.data;

  if (!access) {
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

  const workflow = await loadTaskWorkflow(db, projectId);

  if (!workflow) {
    return c.json(
      {
        error: {
          code: "WORKFLOW_INTEGRITY_ERROR",
          message: "Project task workflow is invalid",
        },
      },
      500,
    );
  }

  const enabledStatusKeys = new Set(workflow.filter((status) => status.enabled).map((status) => status.statusKey));
  const referencesDisabledStatus = input.columns.some((column) => !enabledStatusKeys.has(column.status));

  if (referencesDisabledStatus) {
    return c.json(
      {
        error: {
          code: "TASK_STATUS_DISABLED",
          message: "Task status is disabled for this project",
        },
      },
      400,
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

  const REORDER_UPDATE_CHUNK_SIZE = 20;
  const updateStatements: D1PreparedStatement[] = [];

  for (const column of input.columns) {
    for (let start = 0; start < column.taskIds.length; start += REORDER_UPDATE_CHUNK_SIZE) {
      const chunk = column.taskIds.slice(start, start + REORDER_UPDATE_CHUNK_SIZE);

      if (chunk.length === 0) {
        continue;
      }

      const sortOrderCases = chunk.map(() => "WHEN id = ? THEN ?").join(" ");
      const idPlaceholders = chunk.map(() => "?").join(", ");

      const statement = c.env.flow_db.prepare(`
          UPDATE tasks
          SET
            status = ?,
            sort_order = CASE
              ${sortOrderCases}
              ELSE sort_order
            END,
            updated_at = CAST(strftime('%s', 'now') AS INTEGER)
          WHERE project_id = ?
            AND id IN (${idPlaceholders})
            AND archived_at IS NULL
        `);

      const bindings: Array<string | number> = [column.status];

      chunk.forEach((taskId, chunkIndex) => {
        const absoluteIndex = start + chunkIndex;

        bindings.push(taskId, (absoluteIndex + 1) * 100);
      });

      bindings.push(projectId, ...chunk);

      updateStatements.push(statement.bind(...bindings));
    }
  }

  if (updateStatements.length > 0) {
    await c.env.flow_db.batch(updateStatements);
  }

  return c.json({
    data: {
      success: true as const,
    },
  });
});

tasksRoutes.get("/tasks/:taskId", requireAuth, requirePermission("tasks.view"), async (c) => {
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
  const access = await findAccessibleProject(db, auth, task.projectId);

  if (!access) {
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

tasksRoutes.patch("/tasks/:taskId", requireAuth, async (c) => {
  const auth = c.var.auth;

  const taskId = c.req.param("taskId");

  const canEditTasks = hasPermission(auth, "tasks.edit");

  const canAssignTasks = hasPermission(auth, "tasks.assign");

  if (!canEditTasks && !canAssignTasks) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to modify tasks",
        },
      },
      403,
    );
  }

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

  const access = await findAccessibleProject(db, auth, task.projectId);

  if (!access) {
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

  const body = await c.req.json().catch(() => undefined);

  const parsed = updateTaskSchema.safeParse(body);

  if (!parsed.success) {
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

  const input = parsed.data;

  const editsTask = input.title !== undefined || input.description !== undefined || input.status !== undefined || input.priority !== undefined || input.dueDate !== undefined || input.discordThreadUrl !== undefined;

  const assignsTask = input.assigneeId !== undefined;

  if (editsTask && !canEditTasks) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to edit tasks",
        },
      },
      403,
    );
  }

  if (assignsTask && !canAssignTasks) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to assign tasks",
        },
      },
      403,
    );
  }
  if (input.status !== undefined) {
    const workflow = await loadTaskWorkflow(db, task.projectId);

    if (!workflow) {
      return c.json(
        {
          error: {
            code: "WORKFLOW_INTEGRITY_ERROR",
            message: "Project task workflow is invalid",
          },
        },
        500,
      );
    }

    const workflowStatus = workflow.find((status) => status.statusKey === input.status);

    if (!workflowStatus?.enabled) {
      return c.json(
        {
          error: {
            code: "TASK_STATUS_DISABLED",
            message: "Task status is disabled for this project",
          },
        },
        400,
      );
    }
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
});

tasksRoutes.delete("/tasks/:taskId", requireAuth, requirePermission("tasks.archive"), async (c) => {
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
  const access = await findAccessibleProject(db, auth, task.projectId);

  if (!access) {
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
