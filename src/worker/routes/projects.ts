import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";

import { createProjectSchema, updateProjectSchema, type ProjectDto } from "../../shared/contracts/projects";
import { addProjectMemberSchema, type ProjectMemberDto } from "../../shared/contracts/members";
import { canCreateProjectWithVisibility, canManageProjectMembers, canManageProjectVisibility } from "../../shared/project-privacy";
import { defaultTaskWorkflowStatuses, updateTaskWorkflowSchema, type TaskWorkflowDto, type TaskWorkflowStatusDto } from "../../shared/contracts/task-workflow";

import { createDb } from "../db";
import { clients, projectMembers, projectTaskStatuses, projects, tasks, users, workspaceMembers, workspaceRoles } from "../db/schema";
import { createId } from "../lib/id";
import { filterAccessibleProjects, findAccessibleProject } from "../lib/project-access";
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

projectsRoutes.get("/", requireAuth, requirePermission("projects.view"), async (c) => {
  const auth = c.var.auth;
  const db = createDb(c.env.flow_db);

  const result = await db
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
      discordChannelUrl: projects.discordChannelUrl,
      createdAt: projects.createdAt,
      updatedAt: projects.updatedAt,
    })
    .from(projects)
    .innerJoin(clients, eq(projects.clientId, clients.id))
    .where(and(eq(projects.workspaceId, auth.workspace.id), eq(clients.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .orderBy(desc(projects.updatedAt));

  const accessibleProjects = await filterAccessibleProjects(db, auth, result);

  const data: ProjectDto[] = accessibleProjects.map((project) => ({
    id: project.id,

    client: {
      id: project.clientId,
      name: project.clientName,
    },

    name: project.name,
    description: project.description,
    visibility: project.visibility,
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
  requirePermission("projects.create"),
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

    const projectInsert = db.insert(projects).values({
      id,
      workspaceId: auth.workspace.id,
      clientId: client.id,
      name: input.name,
      description: input.description ?? null,
      visibility,
      status: "planning",
      startDate: null,
      dueDate: null,
      discordChannelUrl: null,

      createdAt: now,
      updatedAt: now,
    });
    const workflowInsert = db.insert(projectTaskStatuses).values(
      defaultTaskWorkflowStatuses.map((status) => ({
        projectId: id,
        statusKey: status.statusKey,
        label: status.label,
        position: status.position,
        enabled: status.enabled,
      })),
    );
    if (visibility === "private") {
      await db.batch([
        projectInsert,

        db.insert(projectMembers).values({
          projectId: id,
          userId: auth.user.id,
          createdAt: now,
        }),

        workflowInsert,
      ]);
    } else {
      await db.batch([projectInsert, workflowInsert]);
    }

    const data: ProjectDto = {
      id,

      client: {
        id: client.id,
        name: client.name,
      },

      name: input.name,
      description: input.description ?? null,
      visibility,
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
    visibility: project.visibility,
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
      description: projects.description,
      visibility: projects.visibility,
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
      visibility,
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
    visibility,
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
});

projectsRoutes.delete("/:id", requireAuth, requirePermission("projects.archive"), async (c) => {
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
    })
    .from(projectMembers)
    .innerJoin(users, eq(projectMembers.userId, users.id))
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.userId, users.id), eq(workspaceMembers.workspaceId, auth.workspace.id)))
    .leftJoin(workspaceRoles, and(eq(workspaceMembers.customRoleId, workspaceRoles.id), eq(workspaceRoles.workspaceId, auth.workspace.id)))
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
  }));

  return c.json({
    data,
  });
});

projectsRoutes.post("/:id/members", requireAuth, requirePermission("projects.edit"), async (c) => {
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

      customRole:
        member.customRoleId && member.customRoleName
          ? {
              id: member.customRoleId,
              name: member.customRoleName,
            }
          : null,
    },

    addedAt: membership.addedAt.toISOString(),
  };

  return c.json({
    data,
  });
});

projectsRoutes.delete("/:id/members/:userId", requireAuth, requirePermission("projects.edit"), async (c) => {
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

  await db.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));

  return c.json({
    data: {
      success: true as const,
    },
  });
});
