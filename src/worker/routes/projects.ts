import { and, asc, desc, eq, inArray, isNull, max } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createProjectSchema, updateProjectSchema, type ProjectDetailDto, type ProjectDto, type ProjectDueDateMode } from "../../shared/contracts/projects";

import { addProjectMemberSchema, type ProjectMemberDto } from "../../shared/contracts/members";

import { replaceProjectLeadsSchema } from "../../shared/contracts/project-leads";

import { createProjectResourceSchema, updateProjectResourceSchema, type ProjectResourceDto } from "../../shared/contracts/project-resources";

import { canCreateProjectWithVisibility, canManageProjectMembers, canManageProjectVisibility } from "../../shared/project-privacy";
import { defaultTaskWorkflowStatuses, updateTaskWorkflowSchema, type TaskWorkflowDto, type TaskWorkflowStatusDto } from "../../shared/contracts/task-workflow";
import { resolveProjectCode } from "../../shared/project-code";

import { createDb } from "../db";
import {
  clients,
  discordOutboxEvents,
  projectDiscordForums,
  projectLeads,
  projectMembers,
  projectResources,
  projectTaskSequences,
  projectTaskStatuses,
  projects,
  taskAssignees,
  tasks,
  users,
  workspaceDiscordIntegrations,
  workspaceMembers,
  workspaceRoles,
} from "../db/schema";
import { createId } from "../lib/id";
import { dispatchDiscordOutboxEvent } from "../lib/discord-outbox";
import { filterAccessibleProjects, findAccessibleProject } from "../lib/project-access";
import { provisionProjectDiscordForum } from "../lib/project-discord-forum";

import { requireAuth, requirePermission } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type ProjectsEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const projectsRoutes = new Hono<ProjectsEnv>();

function isValidTaskWorkflow(statuses: readonly TaskWorkflowStatusDto[]) {
  if (statuses.length !== defaultTaskWorkflowStatuses.length) {
    return false;
  }

  if (statuses.some((status, index) => status.position !== index)) {
    return false;
  }

  return updateTaskWorkflowSchema.safeParse({
    statuses: statuses.map(({ statusKey, label, enabled }) => ({
      statusKey,
      label,
      enabled,
    })),
  }).success;
}

function resolveProjectDueState(currentDueDate: string | null, currentDueDateMode: ProjectDueDateMode, inputDueDate: string | null | undefined, inputDueDateMode: ProjectDueDateMode | undefined) {
  const dueDateProvided = inputDueDate !== undefined;
  const dueDateModeProvided = inputDueDateMode !== undefined;

  let dueDate = dueDateProvided ? inputDueDate : currentDueDate;

  const dueDateMode: ProjectDueDateMode = dueDateModeProvided ? inputDueDateMode : dueDateProvided ? (inputDueDate === null ? "unset" : "date") : currentDueDateMode;

  if (dueDateMode === "date") {
    if (dueDate === null) {
      return null;
    }
  } else {
    if (dueDateProvided && inputDueDate !== null) {
      return null;
    }

    dueDate = null;
  }

  return {
    dueDate,
    dueDateMode,
  };
}

async function resolveEffectiveProjectDueDate(db: ReturnType<typeof createDb>, projectId: string, storedDueDate: string | null, dueDateMode: ProjectDueDateMode) {
  if (dueDateMode === "ongoing") {
    return null;
  }

  const [result] = await db
    .select({
      dueDate: max(tasks.dueDate),
    })
    .from(tasks)
    .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt)));

  return result?.dueDate ?? storedDueDate;
}

projectsRoutes.get("/", requireAuth, requirePermission("projects.view"), async (c) => {
  const auth = c.var.auth;
  const db = createDb(c.env.flow_db);

  const result = await db
    .select({
      id: projects.id,

      clientId: clients.id,
      clientName: clients.name,
      leadUserId: projectLeads.userId,
      name: projects.name,
      projectCodeOverride: projects.projectCodeOverride,
      description: projects.description,
      engagementType: projects.engagementType,
      visibility: projects.visibility,
      status: projects.status,
      startDate: projects.startDate,
      dueDate: projects.dueDate,
      dueDateMode: projects.dueDateMode,
      discordChannelUrl: projects.discordChannelUrl,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(clients, and(eq(projects.clientId, clients.id), eq(clients.workspaceId, auth.workspace.id)))
    .leftJoin(projectLeads, and(eq(projectLeads.projectId, projects.id), eq(projectLeads.position, 0)))
    .where(and(eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt));

  const accessibleProjects = await filterAccessibleProjects(db, auth, result);

  const data: ProjectDto[] = accessibleProjects.map((project) => ({
    id: project.id,

    client:
      project.clientId && project.clientName
        ? {
            id: project.clientId,
            name: project.clientName,
          }
        : null,

    name: project.name,
    projectCode: resolveProjectCode(project.name, project.projectCodeOverride),
    projectCodeOverride: project.projectCodeOverride,
    description: project.description,
    engagementType: project.engagementType,
    leadUserId: project.leadUserId,
    visibility: project.visibility,
    status: project.status,
    startDate: project.startDate,
    dueDate: project.dueDate,
    dueDateMode: project.dueDateMode,
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
  requirePermission("projects.create"),
  zValidator("json", createProjectSchema, (result, c) => {
    if (!result.success) {
      const leadIssue = result.error.issues.find((issue) => issue.path[0] === "leadUserIds");

      if (leadIssue?.code === "too_small") {
        return c.json(
          {
            error: {
              code: "PROJECT_LEAD_REQUIRED",
              message: "At least one project lead is required",
            },
          },
          409,
        );
      }

      if (leadIssue?.code === "too_big") {
        return c.json(
          {
            error: {
              code: "PROJECT_LEAD_LIMIT_REACHED",
              message: "A project can have at most three leads",
            },
          },
          409,
        );
      }

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

    const visibility = input.visibility ?? "workspace";

    if (!canCreateProjectWithVisibility(auth.workspace.permissions, visibility)) {
      return c.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to create this project",
          },
        },
        403,
      );
    }
    let selectedClient: {
      id: string;
      name: string;
    } | null = null;

    if (input.clientId) {
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
    const leadUserIds = input.leadUserIds ?? [auth.user.id];

    const leadMembershipRows = await db
      .select({
        userId: workspaceMembers.userId,
      })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, auth.workspace.id), inArray(workspaceMembers.userId, leadUserIds)));

    if (leadMembershipRows.length !== leadUserIds.length) {
      return c.json(
        {
          error: {
            code: "PROJECT_LEAD_NOT_WORKSPACE_MEMBER",
            message: "Every project lead must be a workspace member",
          },
        },
        409,
      );
    }

    const memberUserIds = [...new Set([auth.user.id, ...leadUserIds])];

    const id = createId("prj");
    const now = new Date();

    const description = input.description || null;

    const [discordIntegration] = await db
      .select({
        enabled: workspaceDiscordIntegrations.enabled,

        guildId: workspaceDiscordIntegrations.guildId,
      })
      .from(workspaceDiscordIntegrations)
      .where(eq(workspaceDiscordIntegrations.workspaceId, auth.workspace.id))
      .limit(1);

    const projectInsert = db.insert(projects).values({
      id,
      workspaceId: auth.workspace.id,

      clientId: selectedClient?.id ?? null,
      leadUserId: leadUserIds[0],

      name: input.name,

      projectCodeOverride: null,

      description,

      engagementType: "project",

      visibility,
      status: "planning",

      startDate: null,
      dueDate: null,
      dueDateMode: "unset",

      discordChannelUrl: null,

      createdAt: now,
      updatedAt: now,
    });

    const memberInsert = db.insert(projectMembers).values(
      memberUserIds.map((userId) => ({
        projectId: id,
        userId,
        createdAt: now,
      })),
    );

    const leadInsert = db.insert(projectLeads).values(
      leadUserIds.map((userId, position) => ({
        projectId: id,
        userId,
        position,
        createdAt: now,
      })),
    );

    const workflowInsert = db.insert(projectTaskStatuses).values(
      defaultTaskWorkflowStatuses.map((status) => ({
        projectId: id,
        statusKey: status.statusKey,
        label: status.label,
        position: status.position,
        enabled: status.enabled,
      })),
    );

    const taskSequenceInsert = db.insert(projectTaskSequences).values({
      projectId: id,
      nextNumber: 1,
    });
    let discordOutboxEventId: string | null = null;

    if (discordIntegration?.enabled && discordIntegration.guildId) {
      const discordForumInsert = db.insert(projectDiscordForums).values({
        projectId: id,

        guildId: discordIntegration.guildId,

        forumChannelId: null,

        provisioningStatus: "pending",

        attemptCount: 0,

        lastError: null,

        lastAttemptAt: null,

        createdAt: now,

        updatedAt: now,
      });

      discordOutboxEventId = createId("obx");

      const discordOutboxInsert = db.insert(discordOutboxEvents).values({
        id: discordOutboxEventId,

        workspaceId: auth.workspace.id,

        aggregateType: "project_forum",

        aggregateId: id,

        eventType: "project_forum.provision",

        status: "pending",

        dispatchAttemptCount: 0,

        lastDispatchError: null,

        dispatchedAt: null,

        createdAt: now,

        updatedAt: now,
      });

      await db.batch([projectInsert, memberInsert, leadInsert, workflowInsert, taskSequenceInsert, discordForumInsert, discordOutboxInsert]);
    } else {
      await db.batch([projectInsert, memberInsert, leadInsert, workflowInsert, taskSequenceInsert]);
    }

    if (discordOutboxEventId) {
      c.executionCtx.waitUntil(
        dispatchDiscordOutboxEvent(db, c.env.FLOW_DISCORD_QUEUE, discordOutboxEventId)
          .then((result) => {
            if (result.status === "error") {
              console.error("Immediate Discord outbox dispatch failed", {
                projectId: id,

                outboxEventId: discordOutboxEventId,

                result,
              });
            }
          })
          .catch((error) => {
            /*
             * Project creation already committed.
             *
             * Do not invalidate the Flow mutation.
             * The durable pending outbox event will
             * be recovered by the scheduled sweeper.
             */
            console.error("Immediate Discord outbox dispatch crashed", {
              projectId: id,

              outboxEventId: discordOutboxEventId,

              error,
            });
          }),
      );
    }

    const data: ProjectDto = {
      id,

      client: selectedClient,
      name: input.name,

      projectCode: resolveProjectCode(input.name, null),

      projectCodeOverride: null,

      description,

      engagementType: "project",

      leadUserId: leadUserIds[0],

      visibility,
      status: "planning",

      startDate: null,
      dueDate: null,
      dueDateMode: "unset",

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

projectsRoutes.post("/:id/discord-forum/provision", requireAuth, requirePermission("settings.manage"), async (c) => {
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

  const result = await provisionProjectDiscordForum(db, c.env.DISCORD_BOT_TOKEN, projectId);

  if (result.status === "ready") {
    return c.json({
      data: result,
    });
  }

  if (result.status === "busy") {
    return c.json(
      {
        error: {
          code: "DISCORD_FORUM_PROVISIONING_BUSY",

          message: "Discord Forum provisioning is already in progress",
        },
      },
      409,
    );
  }

  if (result.status === "error") {
    return c.json(
      {
        error: {
          code: "DISCORD_FORUM_PROVISION_FAILED",

          message: result.message,
        },
      },
      502,
    );
  }

  const error =
    result.reason === "mapping_missing"
      ? {
          code: "DISCORD_FORUM_MAPPING_MISSING",

          message: "This project does not have a Discord Forum provisioning mapping",
        }
      : result.reason === "integration_disabled"
        ? {
            code: "DISCORD_INTEGRATION_DISABLED",

            message: "Discord integration is disabled",
          }
        : {
            code: "DISCORD_NOT_CONNECTED",

            message: "Discord integration is not connected",
          };

  return c.json(
    {
      error,
    },
    409,
  );
});

projectsRoutes.get("/:id/task-workflow", requireAuth, requirePermission("tasks.view"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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

  if (!isValidTaskWorkflow(statuses)) {
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

  const data: TaskWorkflowDto = {
    projectId,
    statuses,
  };

  return c.json({
    data,
  });
});

projectsRoutes.patch("/:id/task-workflow", requireAuth, requirePermission("tasks.edit"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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

  const currentResult = await db
    .select({
      statusKey: projectTaskStatuses.statusKey,
      label: projectTaskStatuses.label,
      position: projectTaskStatuses.position,
      enabled: projectTaskStatuses.enabled,
    })
    .from(projectTaskStatuses)
    .where(eq(projectTaskStatuses.projectId, projectId))
    .orderBy(asc(projectTaskStatuses.position));

  const currentStatuses: TaskWorkflowStatusDto[] = currentResult.map((status) => ({
    statusKey: status.statusKey,
    label: status.label,
    position: status.position,
    enabled: status.enabled,
  }));

  if (!isValidTaskWorkflow(currentStatuses)) {
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

  const body = await c.req.json().catch(() => undefined);

  const parsed = updateTaskWorkflowSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid task workflow data",
        },
      },
      400,
    );
  }

  const input = parsed.data;

  const disabledStatusKeys = input.statuses.filter((status) => !status.enabled).map((status) => status.statusKey);

  if (disabledStatusKeys.length > 0) {
    const [taskUsingDisabledStatus] = await db
      .select({
        id: tasks.id,
        status: tasks.status,
      })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt), inArray(tasks.status, disabledStatusKeys)))
      .limit(1);

    if (taskUsingDisabledStatus) {
      return c.json(
        {
          error: {
            code: "STATUS_IN_USE",
            message: "A disabled status still contains active tasks",
          },
        },
        409,
      );
    }
  }

  const statuses: TaskWorkflowStatusDto[] = input.statuses.map((status, position) => ({
    statusKey: status.statusKey,
    label: status.label,
    position,
    enabled: status.enabled,
  }));

  await db.batch([
    db.delete(projectTaskStatuses).where(eq(projectTaskStatuses.projectId, projectId)),

    db.insert(projectTaskStatuses).values(
      statuses.map((status) => ({
        projectId,
        statusKey: status.statusKey,
        label: status.label,
        position: status.position,
        enabled: status.enabled,
      })),
    ),
  ]);

  const data: TaskWorkflowDto = {
    projectId,
    statuses,
  };

  return c.json({
    data,
  });
});
projectsRoutes.get("/:id", requireAuth, requirePermission("projects.view"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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
  const [project] = await db
    .select({
      id: projects.id,

      clientId: clients.id,
      clientName: clients.name,

      name: projects.name,
      description: projects.description,
      visibility: projects.visibility,
      status: projects.status,
      startDate: projects.startDate,
      dueDate: projects.dueDate,
      dueDateMode: projects.dueDateMode,
      discordChannelUrl: projects.discordChannelUrl,

      discordForumGuildId: projectDiscordForums.guildId,

      discordForumChannelId: projectDiscordForums.forumChannelId,

      discordForumProvisioningStatus: projectDiscordForums.provisioningStatus,

      leadUserId: projectLeads.userId,
      projectCodeOverride: projects.projectCodeOverride,

      engagementType: projects.engagementType,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .leftJoin(clients, and(eq(projects.clientId, clients.id), eq(clients.workspaceId, auth.workspace.id)))
    .leftJoin(projectLeads, and(eq(projectLeads.projectId, projects.id), eq(projectLeads.position, 0)))
    .leftJoin(projectDiscordForums, eq(projectDiscordForums.projectId, projects.id))
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

  const effectiveDueDate = await resolveEffectiveProjectDueDate(db, project.id, project.dueDate, project.dueDateMode);
  const data: ProjectDetailDto = {
    id: project.id,

    client:
      project.clientId && project.clientName
        ? {
            id: project.clientId,
            name: project.clientName,
          }
        : null,

    name: project.name,
    projectCode: resolveProjectCode(project.name, project.projectCodeOverride),
    projectCodeOverride: project.projectCodeOverride,
    description: project.description,
    engagementType: project.engagementType,
    leadUserId: project.leadUserId,
    visibility: project.visibility,
    status: project.status,
    startDate: project.startDate,

    dueDate: project.dueDate,
    dueDateMode: project.dueDateMode,

    effectiveDueDate,

    discordChannelUrl: project.discordChannelUrl,

    discordForumUrl: project.discordForumProvisioningStatus === "ready" && project.discordForumGuildId && project.discordForumChannelId ? `https://discord.com/channels/${project.discordForumGuildId}/${project.discordForumChannelId}` : null,

    createdAt: project.createdAt.toISOString(),

    updatedAt: project.updatedAt.toISOString(),
  };

  return c.json({
    data,
  });
});

projectsRoutes.patch("/:id", requireAuth, requirePermission("projects.edit"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");
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

  const parsed = updateProjectSchema.safeParse(body);

  if (!parsed.success) {
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

  const input = parsed.data;
  const [project] = await db
    .select({
      id: projects.id,

      clientId: clients.id,
      clientName: clients.name,

      name: projects.name,
      leadUserId: projectLeads.userId,
      projectCodeOverride: projects.projectCodeOverride,
      engagementType: projects.engagementType,
      description: projects.description,
      visibility: projects.visibility,
      status: projects.status,
      startDate: projects.startDate,
      dueDate: projects.dueDate,
      dueDateMode: projects.dueDateMode,
      discordChannelUrl: projects.discordChannelUrl,

      createdAt: projects.createdAt,
    })
    .from(projects)
    .leftJoin(clients, and(eq(projects.clientId, clients.id), eq(clients.workspaceId, auth.workspace.id)))
    .leftJoin(projectLeads, and(eq(projectLeads.projectId, projects.id), eq(projectLeads.position, 0)))
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

  const visibility = input.visibility ?? project.visibility;

  if (visibility !== project.visibility && !canManageProjectVisibility(auth.workspace.permissions)) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to change project visibility",
        },
      },
      403,
    );
  }
  let selectedClient =
    project.clientId && project.clientName
      ? {
          id: project.clientId,
          name: project.clientName,
        }
      : null;

  if (input.clientId !== undefined && input.clientId !== project.clientId) {
    if (input.clientId === null) {
      selectedClient = null;
    } else {
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
  }

  const startDate = input.startDate !== undefined ? input.startDate : project.startDate;

  const dueState = resolveProjectDueState(project.dueDate, project.dueDateMode, input.dueDate, input.dueDateMode);

  if (!dueState) {
    return c.json(
      {
        error: {
          code: "INVALID_PROJECT_DUE_STATE",
          message: "Invalid project due date state",
        },
      },
      400,
    );
  }

  const { dueDate, dueDateMode } = dueState;

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
  const projectCodeOverride = input.projectCodeOverride !== undefined ? input.projectCodeOverride : project.projectCodeOverride;
  const engagementType = input.engagementType ?? project.engagementType;

  await db
    .update(projects)
    .set({
      clientId: selectedClient?.id ?? null,
      name,
      projectCodeOverride,
      description,
      engagementType,
      visibility,
      status,
      startDate,
      dueDate,
      dueDateMode,

      discordChannelUrl,
      updatedAt: now,
    })
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)));

  const effectiveDueDate = await resolveEffectiveProjectDueDate(db, project.id, dueDate, dueDateMode);
  const data: ProjectDetailDto = {
    id: project.id,

    client: selectedClient,

    projectCode: resolveProjectCode(name, projectCodeOverride),

    projectCodeOverride,

    engagementType,

    leadUserId: project.leadUserId,
    name,
    description,
    visibility,
    status,
    startDate,

    dueDate,
    dueDateMode,

    effectiveDueDate,

    discordChannelUrl,

    createdAt: project.createdAt.toISOString(),

    updatedAt: now.toISOString(),
  };

  return c.json({
    data,
  });
});

projectsRoutes.post("/:id/archive", requireAuth, requirePermission("projects.archive"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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

projectsRoutes.delete("/:id", requireAuth, requirePermission("projects.delete"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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

  await db.delete(projects).where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});

projectsRoutes.put("/:id/leads", requireAuth, requirePermission("projects.assign"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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

  const parsed = replaceProjectLeadsSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project leads",
        },
      },
      400,
    );
  }

  const input = parsed.data;

  const memberRows = await db
    .select({
      userId: projectMembers.userId,
    })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, projectId), inArray(projectMembers.userId, input.userIds)));

  if (memberRows.length !== input.userIds.length) {
    return c.json(
      {
        error: {
          code: "PROJECT_LEAD_NOT_MEMBER",
          message: "Every project lead must be a current project member",
        },
      },
      409,
    );
  }

  const now = new Date();

  const leads = input.userIds.map((userId, position) => ({
    projectId,
    userId,
    position,
    createdAt: now,
  }));

  await db.batch([
    db.delete(projectLeads).where(eq(projectLeads.projectId, projectId)),

    db.insert(projectLeads).values(leads),

    db
      .update(projects)
      .set({
        leadUserId: input.userIds[0],
        updatedAt: now,
      })
      .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt))),
  ]);

  return c.json({
    data: leads.map((lead) => ({
      userId: lead.userId,
      position: lead.position,
    })),
  });
});

/**
 * * bagian member project
 */
projectsRoutes.get("/:id/members", requireAuth, requirePermission("projects.view"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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
      id: users.id,
      displayName: users.displayName,
      avatarUrl: users.avatarUrl,
      role: workspaceMembers.role,
      customRoleId: workspaceRoles.id,
      customRoleName: workspaceRoles.name,
      addedAt: projectMembers.createdAt,
      leadPosition: projectLeads.position,
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, auth.workspace.id)))
    .leftJoin(workspaceRoles, and(eq(workspaceMembers.customRoleId, workspaceRoles.id), eq(workspaceRoles.workspaceId, auth.workspace.id)))
    .leftJoin(projectLeads, and(eq(projectLeads.projectId, projectMembers.projectId), eq(projectLeads.userId, projectMembers.userId)))
    .where(eq(projectMembers.projectId, projectId))
    .orderBy(asc(users.displayName));

  const data: ProjectMemberDto[] = result.map((member) => ({
    user: {
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
    },

    addedAt: member.addedAt.toISOString(),
    isLead: member.leadPosition !== null,
    leadPosition: member.leadPosition,
  }));

  return c.json({
    data,
  });
});

projectsRoutes.post("/:id/members", requireAuth, requirePermission("projects.assign"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");
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

  if (!canManageProjectMembers(auth.workspace.permissions, access.project.visibility)) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to manage project members",
        },
      },
      403,
    );
  }

  const body = await c.req.json().catch(() => undefined);
  const parsed = addProjectMemberSchema.safeParse(body);

  if (!parsed.success) {
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

  const input = parsed.data;

  const [member] = await db
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
    .leftJoin(workspaceRoles, and(eq(workspaceMembers.customRoleId, workspaceRoles.id), eq(workspaceRoles.workspaceId, auth.workspace.id)))
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
      leadPosition: projectLeads.position,
    })
    .from(projectMembers)
    .leftJoin(projectLeads, and(eq(projectLeads.projectId, projectMembers.projectId), eq(projectLeads.userId, projectMembers.userId)))
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

      customRole:
        member.customRoleId && member.customRoleName
          ? {
              id: member.customRoleId,
              name: member.customRoleName,
            }
          : null,
    },

    addedAt: membership.addedAt.toISOString(),
    isLead: membership.leadPosition !== null,
    leadPosition: membership.leadPosition,
  };

  return c.json({
    data,
  });
});

projectsRoutes.delete("/:id/members/:userId", requireAuth, requirePermission("projects.assign"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");
  const userId = c.req.param("userId");
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

  if (!canManageProjectMembers(auth.workspace.permissions, access.project.visibility)) {
    return c.json(
      {
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to manage project members",
        },
      },
      403,
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

  const currentLeads = await db
    .select({
      userId: projectLeads.userId,
      position: projectLeads.position,
    })
    .from(projectLeads)
    .where(eq(projectLeads.projectId, projectId))
    .orderBy(asc(projectLeads.position));

  if (currentLeads.length === 0) {
    return c.json(
      {
        error: {
          code: "PROJECT_LEAD_REQUIRED",
          message: "Assign a project lead before removing project members",
        },
      },
      409,
    );
  }

  const removedLead = currentLeads.find((lead) => lead.userId === userId);

  if (removedLead && currentLeads.length === 1) {
    return c.json(
      {
        error: {
          code: "PROJECT_LEAD_REQUIRED",
          message: "A project must have at least one project lead",
        },
      },
      409,
    );
  }
  const now = new Date();

  const projectTaskIds = db
    .select({
      id: tasks.id,
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId));

  const taskAssignmentDelete = db.delete(taskAssignees).where(
    and(
      eq(taskAssignees.userId, userId),

      inArray(taskAssignees.taskId, projectTaskIds),
    ),
  );

  const legacyAssigneeClear = db
    .update(tasks)
    .set({
      assigneeId: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(tasks.projectId, projectId),

        eq(tasks.assigneeId, userId),
      ),
    );

  const taskLeadClear = db
    .update(tasks)
    .set({
      leadUserId: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(tasks.projectId, projectId),

        eq(tasks.leadUserId, userId),
      ),
    );

  const projectMemberDelete = db.delete(projectMembers).where(
    and(
      eq(projectMembers.projectId, projectId),

      eq(projectMembers.userId, userId),
    ),
  );

  if (!removedLead) {
    await db.batch([taskAssignmentDelete, legacyAssigneeClear, taskLeadClear, projectMemberDelete]);

    return c.json({
      data: {
        success: true as const,
      },
    });
  }

  const remainingLeads = currentLeads
    .filter((lead) => lead.userId !== userId)
    .map((lead, position) => ({
      projectId,
      userId: lead.userId,
      position,
      createdAt: now,
    }));

  await db.batch([
    taskAssignmentDelete,
    taskLeadClear,
    legacyAssigneeClear,

    db.delete(projectLeads).where(eq(projectLeads.projectId, projectId)),

    db.insert(projectLeads).values(remainingLeads),

    db
      .update(projects)
      .set({
        leadUserId: remainingLeads[0].userId,

        updatedAt: now,
      })
      .where(
        and(
          eq(projects.id, projectId),

          eq(projects.workspaceId, auth.workspace.id),

          isNull(projects.archivedAt),
        ),
      ),

    projectMemberDelete,
  ]);

  return c.json({
    data: {
      success: true as const,
    },
  });
});

projectsRoutes.get("/:id/resources", requireAuth, requirePermission("projects.view"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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
      id: projectResources.id,
      projectId: projectResources.projectId,
      type: projectResources.type,
      title: projectResources.title,
      url: projectResources.url,
      content: projectResources.content,
      position: projectResources.position,
      createdBy: projectResources.createdBy,
      createdAt: projectResources.createdAt,
      updatedAt: projectResources.updatedAt,
    })
    .from(projectResources)
    .where(eq(projectResources.projectId, projectId))
    .orderBy(asc(projectResources.position));

  const data: ProjectResourceDto[] = result.map((resource) => ({
    id: resource.id,
    projectId: resource.projectId,
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

projectsRoutes.post("/:id/resources", requireAuth, requirePermission("projects.edit"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");

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

  const parsed = createProjectResourceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project resource",
        },
      },
      400,
    );
  }

  const input = parsed.data;

  const [lastResource] = await db
    .select({
      position: projectResources.position,
    })
    .from(projectResources)
    .where(eq(projectResources.projectId, projectId))
    .orderBy(desc(projectResources.position))
    .limit(1);

  const position = (lastResource?.position ?? -1) + 1;
  const id = createId("res");
  const now = new Date();

  const resource =
    input.type === "document_brief"
      ? {
          id,
          projectId,
          type: "document_brief" as const,
          title: input.title ?? "Project Brief",
          url: null,
          content: input.content ?? "",
          position,
          createdBy: auth.user.id,
          createdAt: now,
          updatedAt: now,
        }
      : {
          id,
          projectId,
          type: "link" as const,
          title: input.title ?? new URL(input.url).hostname,
          url: input.url,
          content: null,
          position,
          createdBy: auth.user.id,
          createdAt: now,
          updatedAt: now,
        };

  await db.insert(projectResources).values(resource);

  const data: ProjectResourceDto = {
    id: resource.id,
    projectId: resource.projectId,
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

projectsRoutes.patch("/:id/resources/:resourceId", requireAuth, requirePermission("projects.edit"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");
  const resourceId = c.req.param("resourceId");

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

  const [resource] = await db
    .select({
      id: projectResources.id,
      projectId: projectResources.projectId,
      type: projectResources.type,
      title: projectResources.title,
      url: projectResources.url,
      content: projectResources.content,
      position: projectResources.position,
      createdBy: projectResources.createdBy,
      createdAt: projectResources.createdAt,
      updatedAt: projectResources.updatedAt,
    })
    .from(projectResources)
    .where(and(eq(projectResources.id, resourceId), eq(projectResources.projectId, projectId)))
    .limit(1);

  if (!resource) {
    return c.json(
      {
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Project resource not found",
        },
      },
      404,
    );
  }

  const body = await c.req.json().catch(() => undefined);

  const parsed = updateProjectResourceSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid project resource",
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

    title = input.title === undefined ? (resource.title ?? "Project Brief") : (input.title ?? "Project Brief");

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
    .update(projectResources)
    .set({
      title,
      url,
      content,
      updatedAt: now,
    })
    .where(and(eq(projectResources.id, resourceId), eq(projectResources.projectId, projectId)));

  const data: ProjectResourceDto = {
    id: resource.id,
    projectId: resource.projectId,
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

projectsRoutes.delete("/:id/resources/:resourceId", requireAuth, requirePermission("projects.edit"), async (c) => {
  const auth = c.var.auth;
  const projectId = c.req.param("id");
  const resourceId = c.req.param("resourceId");

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

  const [resource] = await db
    .select({
      id: projectResources.id,
    })
    .from(projectResources)
    .where(and(eq(projectResources.id, resourceId), eq(projectResources.projectId, projectId)))
    .limit(1);

  if (!resource) {
    return c.json(
      {
        error: {
          code: "RESOURCE_NOT_FOUND",
          message: "Project resource not found",
        },
      },
      404,
    );
  }

  await db.delete(projectResources).where(and(eq(projectResources.id, resourceId), eq(projectResources.projectId, projectId)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});
