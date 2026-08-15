import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { Hono } from "hono";

import type { DashboardProjectDto, DashboardResponse, DashboardTaskDto } from "../../shared/contracts/dashboard";
import type { TaskStatus } from "../../shared/contracts/tasks";

import { createDb } from "../db";
import { clients, projects, tasks } from "../db/schema";
import { filterAccessibleProjects } from "../lib/project-access";
import { requireAuth, requirePermission } from "../middleware/auth";
import type { AuthContext } from "../types/auth";
import type { AppBindings } from "../types/app-env";

type DashboardEnv = {
  Bindings: AppBindings;

  Variables: {
    auth: AuthContext;
  };
};

export const dashboardRoutes = new Hono<DashboardEnv>();

dashboardRoutes.get("/", requireAuth, requirePermission("dashboard.view"), async (c) => {
  const auth = c.var.auth;

  const db = createDb(c.env.flow_db);

  const activeClients = await db.$count(clients, and(eq(clients.workspaceId, auth.workspace.id), eq(clients.status, "active"), isNull(clients.archivedAt)));

  const projectAccessRows = await db
    .select({
      id: projects.id,
      visibility: projects.visibility,
      status: projects.status,
    })
    .from(projects)
    .where(and(eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)));

  const accessibleProjects = await filterAccessibleProjects(db, auth, projectAccessRows);

  const accessibleProjectIds = accessibleProjects.map((project) => project.id);

  const activeProjects = accessibleProjects.filter((project) => project.status === "active").length;

  const [taskSummary] =
    accessibleProjectIds.length > 0
      ? await db
          .select({
            openTasks: sql<number>`
            coalesce(
              sum(
                case
                  when ${tasks.status} <> ${"done"}
                  then 1
                  else 0
                end
              ),
              0
            )
          `,

            myTasks: sql<number>`
            coalesce(
              sum(
                case
                  when
                    ${tasks.status} <> ${"done"}
                    and ${tasks.assigneeId} = ${auth.user.id}
                  then 1
                  else 0
                end
              ),
              0
            )
          `,

            backlog: sql<number>`
            coalesce(
              sum(
                case
                  when ${tasks.status} = ${"backlog"}
                  then 1
                  else 0
                end
              ),
              0
            )
          `,

            todo: sql<number>`
            coalesce(
              sum(
                case
                  when ${tasks.status} = ${"todo"}
                  then 1
                  else 0
                end
              ),
              0
            )
          `,

            inProgress: sql<number>`
            coalesce(
              sum(
                case
                  when ${tasks.status} = ${"in_progress"}
                  then 1
                  else 0
                end
              ),
              0
            )
          `,

            review: sql<number>`
            coalesce(
              sum(
                case
                  when ${tasks.status} = ${"review"}
                  then 1
                  else 0
                end
              ),
              0
            )
          `,

            done: sql<number>`
            coalesce(
              sum(
                case
                  when ${tasks.status} = ${"done"}
                  then 1
                  else 0
                end
              ),
              0
            )
          `,
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(and(inArray(projects.id, accessibleProjectIds), ne(projects.status, "completed"), isNull(tasks.archivedAt)))
      : [];

  const taskStatus: Record<TaskStatus, number> = {
    backlog: Number(taskSummary?.backlog ?? 0),

    todo: Number(taskSummary?.todo ?? 0),

    in_progress: Number(taskSummary?.inProgress ?? 0),

    review: Number(taskSummary?.review ?? 0),

    done: Number(taskSummary?.done ?? 0),
  };

  const myTaskRows =
    accessibleProjectIds.length > 0
      ? await db
          .select({
            id: tasks.id,

            projectId: projects.id,

            projectName: projects.name,

            title: tasks.title,

            status: tasks.status,

            priority: tasks.priority,

            dueDate: tasks.dueDate,

            updatedAt: tasks.updatedAt,
          })
          .from(tasks)
          .innerJoin(projects, eq(tasks.projectId, projects.id))
          .where(and(inArray(projects.id, accessibleProjectIds), ne(projects.status, "completed"), isNull(tasks.archivedAt), ne(tasks.status, "done"), eq(tasks.assigneeId, auth.user.id)))
          .orderBy(desc(tasks.updatedAt))
          .limit(6)
      : [];
  const myTasks: DashboardTaskDto[] = myTaskRows.map((task) => ({
    id: task.id,

    projectId: task.projectId,

    projectName: task.projectName,

    title: task.title,

    status: task.status,

    priority: task.priority,

    dueDate: task.dueDate,
  }));

  const recentProjectRows =
    accessibleProjectIds.length > 0
      ? await db
          .select({
            id: projects.id,

            clientId: clients.id,

            clientName: clients.name,

            name: projects.name,

            status: projects.status,

            dueDate: projects.dueDate,

            updatedAt: projects.updatedAt,
          })
          .from(projects)
          .innerJoin(clients, eq(projects.clientId, clients.id))
          .where(and(inArray(projects.id, accessibleProjectIds), ne(projects.status, "completed")))
          .orderBy(desc(projects.updatedAt))
          .limit(5)
      : [];

  const recentProjectIds = recentProjectRows.map((project) => project.id);

  const progressRows =
    recentProjectIds.length > 0
      ? await db
          .select({
            projectId: tasks.projectId,

            total: sql<number>`
                  count(*)
                `,

            done: sql<number>`
                  coalesce(
                    sum(
                      case
                        when ${tasks.status} = ${"done"}
                        then 1
                        else 0
                      end
                    ),
                    0
                  )
                `,
          })
          .from(tasks)
          .where(and(inArray(tasks.projectId, recentProjectIds), isNull(tasks.archivedAt)))
          .groupBy(tasks.projectId)
      : [];

  const progressByProject = new Map<
    string,
    {
      total: number;
      done: number;
    }
  >();

  for (const row of progressRows) {
    progressByProject.set(row.projectId, {
      total: Number(row.total),

      done: Number(row.done),
    });
  }

  const recentProjects: DashboardProjectDto[] = recentProjectRows.map((project) => {
    const progress = progressByProject.get(project.id);

    const total = progress?.total ?? 0;

    const done = progress?.done ?? 0;

    return {
      id: project.id,

      name: project.name,

      client: {
        id: project.clientId,

        name: project.clientName,
      },

      status: project.status,

      dueDate: project.dueDate,

      progress: total > 0 ? Math.round((done / total) * 100) : 0,

      updatedAt: project.updatedAt.toISOString(),
    };
  });

  const data: DashboardResponse["data"] = {
    counts: {
      activeClients,

      activeProjects,

      openTasks: Number(taskSummary?.openTasks ?? 0),

      myTasks: Number(taskSummary?.myTasks ?? 0),
    },

    taskStatus,

    myTasks,

    recentProjects,
  };

  return c.json({
    data,
  });
});
