import { and, asc, eq, inArray, isNull, max } from "drizzle-orm";
import { Hono } from "hono";

import { createTaskSchema, reorderTasksSchema, updateTaskSchema, type TaskAssigneeDto, type TaskDto, type TaskLeadDto } from "../../shared/contracts/tasks";
import { resolveProjectCode } from "../../shared/project-code";
import { defaultTaskWorkflowStatuses, updateTaskWorkflowSchema, type TaskWorkflowStatusDto } from "../../shared/contracts/task-workflow";
import { createTaskResourceSchema, updateTaskResourceSchema, type TaskResourceDto } from "../../shared/contracts/task-resources";

import { createDb } from "../db";
import { projectDiscordForums, projectMembers, projectTaskStatuses, projects, taskAssignees, taskResources, tasks, users, workspaceDiscordIntegrations, workspaceMembers } from "../db/schema";
import { createId } from "../lib/id";
import { findAccessibleProject } from "../lib/project-access";
import { hasPermission, requireAuth, requirePermission } from "../middleware/auth";
import { provisionTaskDiscordThread } from "../lib/task-discord-thread";

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

async function findActiveAccessibleTask(db: Db, auth: AuthContext, taskId: string) {
  const [task] = await db
    .select({
      id: tasks.id,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.id, taskId),

        eq(projects.workspaceId, auth.workspace.id),

        isNull(projects.archivedAt),

        isNull(tasks.archivedAt),
      ),
    )
    .limit(1);

  if (!task) {
    return null;
  }

  const access = await findAccessibleProject(db, auth, task.projectId);

  if (!access) {
    return null;
  }

  return task;
}

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

async function loadTaskAssigneeMap(db: Db, taskIds: readonly string[]) {
  const result = new Map<string, TaskAssigneeDto[]>();

  if (taskIds.length === 0) {
    return result;
  }

  const rows = await db
    .select({
      taskId: taskAssignees.taskId,

      userId: users.id,

      displayName: users.displayName,

      avatarUrl: users.avatarUrl,

      createdAt: taskAssignees.createdAt,
    })
    .from(taskAssignees)
    .innerJoin(users, eq(taskAssignees.userId, users.id))
    .where(inArray(taskAssignees.taskId, [...taskIds]))
    .orderBy(asc(taskAssignees.createdAt), asc(taskAssignees.userId));

  for (const row of rows) {
    const existing = result.get(row.taskId) ?? [];

    existing.push({
      id: row.userId,
      displayName: row.displayName,
      avatarUrl: row.avatarUrl,
    });

    result.set(row.taskId, existing);
  }

  return result;
}

async function loadTaskLeadMap(db: Db, taskIds: readonly string[]) {
  const result = new Map<string, TaskLeadDto>();

  if (taskIds.length === 0) {
    return result;
  }

  const rows = await db
    .select({
      taskId: tasks.id,

      userId: users.id,

      displayName: users.displayName,

      avatarUrl: users.avatarUrl,
    })
    .from(tasks)
    .innerJoin(
      projectMembers,
      and(
        eq(projectMembers.projectId, tasks.projectId),

        eq(projectMembers.userId, tasks.leadUserId),
      ),
    )
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .where(inArray(tasks.id, [...taskIds]));

  for (const row of rows) {
    result.set(row.taskId, {
      id: row.userId,

      displayName: row.displayName,

      avatarUrl: row.avatarUrl,
    });
  }

  return result;
}

async function resolveAvailableAssignees(db: Db, auth: AuthContext, projectId: string, userIds: readonly string[]): Promise<TaskAssigneeDto[] | null> {
  if (userIds.length === 0) {
    return [];
  }

  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, auth.workspace.id)))
    .where(and(eq(projectMembers.projectId, projectId), inArray(projectMembers.userId, [...userIds])));

  const byId = new Map(rows.map((row) => [row.id, row]));

  if (byId.size !== userIds.length) {
    return null;
  }

  return userIds.map((userId) => {
    const user = byId.get(userId);

    if (!user) {
      throw new Error("Task assignee resolution failed");
    }

    return user;
  });
}

async function loadTaskDto(db: Db, taskId: string): Promise<TaskDto | null> {
  const [task] = await db
    .select({
      id: tasks.id,

      projectId: tasks.projectId,

      projectName: projects.name,

      projectCodeOverride: projects.projectCodeOverride,

      taskNumber: tasks.taskNumber,

      title: tasks.title,

      description: tasks.description,

      status: tasks.status,

      priority: tasks.priority,
      leadUserId: tasks.leadUserId,
      startDate: tasks.startDate,

      dueDate: tasks.dueDate,

      sortOrder: tasks.sortOrder,

      discordThreadUrl: tasks.discordThreadUrl,

      createdAt: tasks.createdAt,

      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.id, taskId), isNull(tasks.archivedAt), isNull(projects.archivedAt)))
    .limit(1);

  if (!task) {
    return null;
  }

  const assigneeMap = await loadTaskAssigneeMap(db, [task.id]);
  const leadMap = await loadTaskLeadMap(db, [task.id]);

  return {
    id: task.id,

    projectId: task.projectId,

    taskNumber: task.taskNumber,

    taskCode: `${resolveProjectCode(task.projectName, task.projectCodeOverride)}-${task.taskNumber}`,

    title: task.title,

    description: task.description,

    status: task.status,

    priority: task.priority,

    lead: leadMap.get(task.id) ?? null,
    assignees: assigneeMap.get(task.id) ?? [],

    startDate: task.startDate,

    dueDate: task.dueDate,

    sortOrder: task.sortOrder,

    discordThreadUrl: task.discordThreadUrl,

    createdAt: task.createdAt.toISOString(),

    updatedAt: task.updatedAt.toISOString(),
  };
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

      projectName: projects.name,

      projectCodeOverride: projects.projectCodeOverride,

      taskNumber: tasks.taskNumber,

      title: tasks.title,

      description: tasks.description,

      status: tasks.status,

      priority: tasks.priority,
      leadUserId: tasks.leadUserId,
      startDate: tasks.startDate,

      dueDate: tasks.dueDate,

      sortOrder: tasks.sortOrder,

      discordThreadUrl: tasks.discordThreadUrl,

      createdAt: tasks.createdAt,

      updatedAt: tasks.updatedAt,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)))
    .orderBy(asc(tasks.sortOrder), asc(tasks.createdAt));

  const assigneeMap = await loadTaskAssigneeMap(
    db,
    result.map((task) => task.id),
  );
  const leadMap = await loadTaskLeadMap(
    db,
    result.map((task) => task.id),
  );
  const data: TaskDto[] = result.map((task) => ({
    id: task.id,

    projectId: task.projectId,

    taskNumber: task.taskNumber,

    taskCode: `${resolveProjectCode(task.projectName, task.projectCodeOverride)}-${task.taskNumber}`,

    title: task.title,

    description: task.description,

    status: task.status,

    priority: task.priority,

    lead: leadMap.get(task.id) ?? null,
    assignees: assigneeMap.get(task.id) ?? [],

    startDate: task.startDate,

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

  const assigneeIds = input.assigneeIds ?? [];

  if (assigneeIds.length > 0 && !hasPermission(auth, "tasks.assign")) {
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

  const assignees = await resolveAvailableAssignees(db, auth, projectId, assigneeIds);

  if (!assignees) {
    return c.json(
      {
        error: {
          code: "ASSIGNEE_NOT_AVAILABLE",

          message: "Task assignees must be project members",
        },
      },
      400,
    );
  }

  const leadUserId = input.leadUserId ?? null;

  if (leadUserId && !hasPermission(auth, "tasks.assign")) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",

          message: "You do not have permission to assign task leads",
        },
      },
      403,
    );
  }

  if (leadUserId) {
    const leadMembers = await resolveAvailableAssignees(db, auth, projectId, [leadUserId]);

    if (!leadMembers) {
      return c.json(
        {
          error: {
            code: "TASK_LEAD_NOT_AVAILABLE",

            message: "Task lead must be a project member",
          },
        },
        400,
      );
    }
  }

  const now = new Date();

  const startDate = input.startDate ?? now.toISOString().slice(0, 10);
  const dueDate = input.dueDate ?? null;

  if (dueDate && dueDate < startDate) {
    return c.json(
      {
        error: {
          code: "TASK_DATE_RANGE_INVALID",

          message: "Due date cannot be before start date",
        },
      },
      400,
    );
  }

  const [discordIntegration] = await db
    .select({
      enabled: workspaceDiscordIntegrations.enabled,

      guildId: workspaceDiscordIntegrations.guildId,
    })
    .from(workspaceDiscordIntegrations)
    .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
    .limit(1);

  let projectDiscordForum: {
    guildId: string;
    forumChannelId: string | null;
  } | null = null;

  if (discordIntegration?.enabled && discordIntegration.guildId) {
    const [mapping] = await db
      .select({
        guildId: projectDiscordForums.guildId,

        forumChannelId: projectDiscordForums.forumChannelId,
      })
      .from(projectDiscordForums)
      .where(eq(projectDiscordForums.projectId, projectId))
      .limit(1);

    projectDiscordForum = mapping ?? null;
  }

  const id = createId("tsk");

  const discordOutboxEventId = projectDiscordForum ? createId("obx") : null;

  const description = input.description ? input.description : null;
  const priority = input.priority ?? null;

  const nowSeconds = Math.floor(now.getTime() / 1000);
  const taskInsert = c.env.flow_db
    .prepare(
      `
        INSERT INTO tasks (
          id,
          project_id,
          task_number,
          title,
          description,
          status,
          priority,
          assignee_id,
          lead_user_id,
          start_date,
          due_date,
          sort_order,
          discord_thread_url,
          created_by,
          created_at,
          updated_at,
          archived_at
        )
        SELECT
          ?,
          ?,
          sequence.next_number,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,
          ?,

          COALESCE(
            (
              SELECT
                MAX(existing.sort_order)
              FROM tasks AS existing
              WHERE
                existing.project_id = ?
                AND existing.status = ?
                AND existing.archived_at IS NULL
            ),
            0
          ) + 100,

          NULL,
          ?,
          ?,
          ?,
          NULL

        FROM project_task_sequences AS sequence

        WHERE
          sequence.project_id = ?
      `,
    )
    .bind(
      id,
      projectId,

      input.title,
      description,
      status,
      priority,

      assigneeIds[0] ?? null,

      leadUserId,

      startDate,
      dueDate,

      projectId,
      status,

      auth.user.id,
      nowSeconds,
      nowSeconds,

      projectId,
    );

  const sequenceAdvance = c.env.flow_db
    .prepare(
      `
        UPDATE project_task_sequences

        SET
          next_number =
            next_number + 1

        WHERE
          project_id = ?
      `,
    )
    .bind(projectId);

  const statements: D1PreparedStatement[] = [taskInsert, sequenceAdvance];

  if (projectDiscordForum && discordOutboxEventId) {
    statements.push(
      c.env.flow_db
        .prepare(
          `
          INSERT INTO task_discord_threads (
            task_id,
            guild_id,
            forum_channel_id,
            thread_id,
            initial_message_id,
            provisioning_status,
            attempt_count,
            last_error,
            last_attempt_at,
            created_at,
            updated_at
          )
          VALUES (
            ?,
            ?,
            ?,
            NULL,
            NULL,
            'pending',
            0,
            NULL,
            NULL,
            ?,
            ?
          )
        `,
        )
        .bind(id, projectDiscordForum.guildId, projectDiscordForum.forumChannelId, nowSeconds, nowSeconds),
    );

    statements.push(
      c.env.flow_db
        .prepare(
          `
          INSERT INTO discord_outbox_events (
            id,
            workspace_id,
            aggregate_type,
            aggregate_id,
            event_type,
            status,
            dispatch_attempt_count,
            last_dispatch_error,
            dispatched_at,
            created_at,
            updated_at
          )
          VALUES (
            ?,
            ?,
            'task_thread',
            ?,
            'task_thread.provision',
            'pending',
            0,
            NULL,
            NULL,
            ?,
            ?
          )
        `,
        )
        .bind(discordOutboxEventId, auth.workspace.id, id, nowSeconds, nowSeconds),
    );
  }

  for (const userId of assigneeIds) {
    statements.push(
      c.env.flow_db
        .prepare(
          `
            INSERT INTO task_assignees (
              task_id,
              user_id,
              created_at
            )
            VALUES (?, ?, ?)
          `,
        )
        .bind(id, userId, nowSeconds),
    );
  }

  await c.env.flow_db.batch(statements);

  const data = await loadTaskDto(db, id);

  if (!data) {
    return c.json(
      {
        error: {
          code: "TASK_CREATE_FAILED",

          message: "Task could not be loaded after creation",
        },
      },
      500,
    );
  }

  return c.json(
    {
      data,
    },
    201,
  );
});

tasksRoutes.post("/projects/:projectId/tasks/:taskId/discord-thread/provision", requireAuth, requirePermission("settings.manage"), async (c) => {
  const auth = c.var.auth;

  const projectId = c.req.param("projectId");

  const taskId = c.req.param("taskId");

  const db = createDb(c.env.flow_db);

  const [task] = await db
    .select({
      id: tasks.id,
    })
    .from(tasks)
    .innerJoin(projects, eq(projects.id, tasks.projectId))
    .where(
      and(
        eq(tasks.id, taskId),

        eq(tasks.projectId, projectId),

        eq(projects.workspaceId, auth.workspace.id),

        isNull(projects.archivedAt),

        isNull(tasks.archivedAt),
      ),
    )
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

  const result = await provisionTaskDiscordThread(db, c.env.DISCORD_BOT_TOKEN, taskId);

  if (result.status === "ready") {
    return c.json({
      data: result,
    });
  }

  if (result.status === "busy") {
    return c.json(
      {
        error: {
          code: "DISCORD_TASK_THREAD_PROVISIONING_BUSY",

          message: "Discord Task thread provisioning is already in progress",
        },
      },
      409,
    );
  }

  if (result.status === "error") {
    return c.json(
      {
        error: {
          code: "DISCORD_TASK_THREAD_PROVISION_FAILED",

          message: result.message,
        },
      },
      502,
    );
  }

  const error =
    result.reason === "mapping_missing"
      ? {
          code: "DISCORD_TASK_THREAD_MAPPING_MISSING",

          message: "This Task does not have a Discord thread provisioning mapping",
        }
      : result.reason === "integration_disabled"
        ? {
            code: "DISCORD_INTEGRATION_DISABLED",

            message: "Discord integration is disabled",
          }
        : result.reason === "integration_not_connected"
          ? {
              code: "DISCORD_NOT_CONNECTED",

              message: "Discord integration is not connected",
            }
          : {
              code: "DISCORD_PROJECT_FORUM_NOT_READY",

              message: "The Project Discord Forum is not ready",
            };

  return c.json(
    {
      error,
    },
    409,
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

  const data = await loadTaskDto(db, taskId);

  if (!data) {
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

  const access = await findAccessibleProject(db, auth, data.projectId);

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

      taskNumber: tasks.taskNumber,

      title: tasks.title,

      description: tasks.description,

      status: tasks.status,

      priority: tasks.priority,
      leadUserId: tasks.leadUserId,
      assigneeId: tasks.assigneeId,

      startDate: tasks.startDate,

      dueDate: tasks.dueDate,

      sortOrder: tasks.sortOrder,

      discordThreadUrl: tasks.discordThreadUrl,
    })
    .from(tasks)
    .innerJoin(projects, eq(tasks.projectId, projects.id))
    .where(
      and(
        eq(tasks.id, taskId),

        eq(projects.workspaceId, auth.workspace.id),

        isNull(projects.archivedAt),

        isNull(tasks.archivedAt),
      ),
    )
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

  if (input.leadUserId !== undefined && input.leadUserId !== null) {
    const leadMembers = await resolveAvailableAssignees(db, auth, task.projectId, [input.leadUserId]);

    if (!leadMembers) {
      return c.json(
        {
          error: {
            code: "TASK_LEAD_NOT_AVAILABLE",

            message: "Task lead must be a project member",
          },
        },
        400,
      );
    }
  }

  const editsTask = input.title !== undefined || input.description !== undefined || input.status !== undefined || input.priority !== undefined || input.startDate !== undefined || input.dueDate !== undefined || input.discordThreadUrl !== undefined;

  const assignsTask = input.assigneeIds !== undefined || input.leadUserId !== undefined;

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

  const assigneeIds = input.assigneeIds;

  if (assigneeIds) {
    const assignees = await resolveAvailableAssignees(db, auth, task.projectId, assigneeIds);

    if (!assignees) {
      return c.json(
        {
          error: {
            code: "ASSIGNEE_NOT_AVAILABLE",

            message: "Task assignees must be project members",
          },
        },
        400,
      );
    }
  }

  if (input.leadUserId !== undefined && input.leadUserId !== null) {
    const leadMembers = await resolveAvailableAssignees(db, auth, task.projectId, [input.leadUserId]);

    if (!leadMembers) {
      return c.json(
        {
          error: {
            code: "TASK_LEAD_NOT_AVAILABLE",

            message: "Task lead must be a project member",
          },
        },
        400,
      );
    }
  }
  const status = input.status ?? task.status;

  let sortOrder = task.sortOrder;

  if (status !== task.status) {
    const [position] = await db
      .select({
        maxSortOrder: max(tasks.sortOrder),
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.projectId, task.projectId),

          eq(tasks.status, status),

          isNull(tasks.archivedAt),
        ),
      );

    sortOrder = (position?.maxSortOrder ?? 0) + 100;
  }

  const title = input.title ?? task.title;

  const description = input.description !== undefined ? input.description : task.description;

  const priority = input.priority !== undefined ? input.priority : task.priority;

  const startDate = input.startDate ?? task.startDate;

  const dueDate = input.dueDate !== undefined ? input.dueDate : task.dueDate;

  if (dueDate && dueDate < startDate) {
    return c.json(
      {
        error: {
          code: "TASK_DATE_RANGE_INVALID",

          message: "Due date cannot be before start date",
        },
      },
      400,
    );
  }

  const discordThreadUrl = input.discordThreadUrl !== undefined ? input.discordThreadUrl : task.discordThreadUrl;

  const legacyAssigneeId = assigneeIds !== undefined ? (assigneeIds[0] ?? null) : task.assigneeId;
  const leadUserId = input.leadUserId !== undefined ? input.leadUserId : task.leadUserId;

  const now = new Date();

  const taskUpdate = db
    .update(tasks)
    .set({
      title,
      description,
      status,
      priority,

      assigneeId: legacyAssigneeId,
      leadUserId,
      startDate,
      dueDate,

      sortOrder,

      discordThreadUrl,

      updatedAt: now,
    })
    .where(
      and(
        eq(tasks.id, taskId),

        eq(tasks.projectId, task.projectId),

        isNull(tasks.archivedAt),
      ),
    );

  if (assigneeIds !== undefined) {
    const assignmentDelete = db.delete(taskAssignees).where(eq(taskAssignees.taskId, taskId));

    if (assigneeIds.length > 0) {
      const assignmentInsert = db.insert(taskAssignees).values(
        assigneeIds.map((userId) => ({
          taskId,
          userId,
          createdAt: now,
        })),
      );

      await db.batch([taskUpdate, assignmentDelete, assignmentInsert]);
    } else {
      await db.batch([taskUpdate, assignmentDelete]);
    }
  } else {
    await taskUpdate;
  }

  const data = await loadTaskDto(db, taskId);

  if (!data) {
    return c.json(
      {
        error: {
          code: "TASK_UPDATE_FAILED",

          message: "Task could not be loaded after update",
        },
      },
      500,
    );
  }

  return c.json({
    data,
  });
});

tasksRoutes.get("/tasks/:taskId/resources", requireAuth, requirePermission("tasks.view"), async (c) => {
  const auth = c.var.auth;

  const taskId = c.req.param("taskId");

  const db = createDb(c.env.flow_db);

  const task = await findActiveAccessibleTask(db, auth, taskId);

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

  const result = await db
    .select({
      id: taskResources.id,

      taskId: taskResources.taskId,

      type: taskResources.type,

      title: taskResources.title,

      url: taskResources.url,

      content: taskResources.content,

      position: taskResources.position,

      createdBy: taskResources.createdBy,

      createdAt: taskResources.createdAt,

      updatedAt: taskResources.updatedAt,
    })
    .from(taskResources)
    .where(eq(taskResources.taskId, task.id))
    .orderBy(asc(taskResources.position));

  const data: TaskResourceDto[] = result.map((resource) => ({
    id: resource.id,

    taskId: resource.taskId,

    type: resource.type,

    title: resource.title,

    url: resource.url,

    content: resource.content,

    position: resource.position,

    createdBy: resource.createdBy,

    createdAt: resource.createdAt.toISOString(),

    updatedAt: resource.updatedAt.toISOString(),
  }));

  return c.json({
    data,
  });
});

tasksRoutes.post("/tasks/:taskId/resources", requireAuth, requirePermission("tasks.edit"), async (c) => {
  const auth = c.var.auth;

  const taskId = c.req.param("taskId");

  const db = createDb(c.env.flow_db);

  const task = await findActiveAccessibleTask(db, auth, taskId);

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

  const body = await c.req.json().catch(() => undefined);

  const parsed = createTaskResourceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",

          message: "Invalid task resource",
        },
      },
      400,
    );
  }

  const input = parsed.data;

  const [lastResource] = await db
    .select({
      maxPosition: max(taskResources.position),
    })
    .from(taskResources)
    .where(eq(taskResources.taskId, task.id));

  const position = (lastResource?.maxPosition ?? -1) + 1;

  const id = createId("res");

  const now = new Date();

  const resource =
    input.type === "document_brief"
      ? {
          id,

          taskId: task.id,

          type: "document_brief" as const,

          title: input.title ?? "Task Brief",

          url: null,

          content: input.content ?? "",

          position,

          createdBy: auth.user.id,

          createdAt: now,

          updatedAt: now,
        }
      : {
          id,

          taskId: task.id,

          type: "link" as const,

          title: input.title ?? new URL(input.url).hostname,

          url: input.url,

          content: null,

          position,

          createdBy: auth.user.id,

          createdAt: now,

          updatedAt: now,
        };

  await db.insert(taskResources).values(resource);

  const data: TaskResourceDto = {
    id: resource.id,

    taskId: resource.taskId,

    type: resource.type,

    title: resource.title,

    url: resource.url,

    content: resource.content,

    position: resource.position,

    createdBy: resource.createdBy,

    createdAt: resource.createdAt.toISOString(),

    updatedAt: resource.updatedAt.toISOString(),
  };

  return c.json(
    {
      data,
    },
    201,
  );
});

tasksRoutes.patch("/tasks/:taskId/resources/:resourceId", requireAuth, requirePermission("tasks.edit"), async (c) => {
  const auth = c.var.auth;

  const taskId = c.req.param("taskId");

  const resourceId = c.req.param("resourceId");

  const db = createDb(c.env.flow_db);

  const task = await findActiveAccessibleTask(db, auth, taskId);

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

  const [resource] = await db
    .select({
      id: taskResources.id,

      taskId: taskResources.taskId,

      type: taskResources.type,

      title: taskResources.title,

      url: taskResources.url,

      content: taskResources.content,

      position: taskResources.position,

      createdBy: taskResources.createdBy,

      createdAt: taskResources.createdAt,
    })
    .from(taskResources)
    .where(
      and(
        eq(taskResources.id, resourceId),

        eq(taskResources.taskId, task.id),
      ),
    )
    .limit(1);

  if (!resource) {
    return c.json(
      {
        error: {
          code: "RESOURCE_NOT_FOUND",

          message: "Task resource not found",
        },
      },
      404,
    );
  }

  const body = await c.req.json().catch(() => undefined);

  const parsed = updateTaskResourceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",

          message: "Invalid task resource",
        },
      },
      400,
    );
  }

  const input = parsed.data;

  const now = new Date();

  let title: string;

  let url: string | null;

  let content: string | null;

  if (resource.type === "document_brief") {
    if (input.url !== undefined && input.url !== null) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",

            message: "Document brief cannot contain an external URL",
          },
        },
        400,
      );
    }

    title = input.title === undefined ? (resource.title ?? "Task Brief") : (input.title ?? "Task Brief");

    url = null;

    content = input.content === undefined ? (resource.content ?? "") : (input.content ?? "");
  } else {
    if (input.content !== undefined && input.content !== null) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",

            message: "Link resource cannot contain document content",
          },
        },
        400,
      );
    }

    url = input.url === undefined ? resource.url : input.url;

    if (!url) {
      return c.json(
        {
          error: {
            code: "VALIDATION_ERROR",

            message: "Link resource requires a URL",
          },
        },
        400,
      );
    }

    title = input.title === undefined ? (resource.title ?? new URL(url).hostname) : (input.title ?? new URL(url).hostname);

    content = null;
  }

  await db
    .update(taskResources)
    .set({
      title,
      url,
      content,

      updatedAt: now,
    })
    .where(
      and(
        eq(taskResources.id, resource.id),

        eq(taskResources.taskId, task.id),
      ),
    );

  const data: TaskResourceDto = {
    id: resource.id,

    taskId: resource.taskId,

    type: resource.type,

    title,
    url,
    content,

    position: resource.position,

    createdBy: resource.createdBy,

    createdAt: resource.createdAt.toISOString(),

    updatedAt: now.toISOString(),
  };

  return c.json({
    data,
  });
});

tasksRoutes.delete("/tasks/:taskId/resources/:resourceId", requireAuth, requirePermission("tasks.edit"), async (c) => {
  const auth = c.var.auth;

  const taskId = c.req.param("taskId");

  const resourceId = c.req.param("resourceId");

  const db = createDb(c.env.flow_db);

  const task = await findActiveAccessibleTask(db, auth, taskId);

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

  const [resource] = await db
    .select({
      id: taskResources.id,
    })
    .from(taskResources)
    .where(
      and(
        eq(taskResources.id, resourceId),

        eq(taskResources.taskId, task.id),
      ),
    )
    .limit(1);

  if (!resource) {
    return c.json(
      {
        error: {
          code: "RESOURCE_NOT_FOUND",

          message: "Task resource not found",
        },
      },
      404,
    );
  }

  await db.delete(taskResources).where(
    and(
      eq(taskResources.id, resource.id),

      eq(taskResources.taskId, task.id),
    ),
  );

  return c.json({
    data: {
      success: true as const,
    },
  });
});

tasksRoutes.post("/tasks/:taskId/archive", requireAuth, requirePermission("tasks.archive"), async (c) => {
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

tasksRoutes.delete("/tasks/:taskId", requireAuth, requirePermission("tasks.delete"), async (c) => {
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
    .where(
      and(
        eq(tasks.id, taskId),

        eq(projects.workspaceId, auth.workspace.id),

        isNull(projects.archivedAt),

        isNull(tasks.archivedAt),
      ),
    )
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

  await db.delete(tasks).where(
    and(
      eq(tasks.id, task.id),

      eq(tasks.projectId, task.projectId),

      isNull(tasks.archivedAt),
    ),
  );

  return c.json({
    data: {
      success: true as const,
    },
  });
});
