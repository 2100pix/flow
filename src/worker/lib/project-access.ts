import { and, eq, inArray, isNull } from "drizzle-orm";

import { canViewProject, type ProjectVisibility } from "../../shared/project-privacy";

import type { createDb } from "../db";
import { projectMembers, projects } from "../db/schema";
import type { AuthContext } from "../types/auth";

type Db = ReturnType<typeof createDb>;

export type AccessibleProject = {
  project: {
    id: string;
    visibility: ProjectVisibility;
  };

  isProjectMember: boolean;
};

export async function findAccessibleProject(db: Db, auth: AuthContext, projectId: string): Promise<AccessibleProject | null> {
  const [project] = await db
    .select({
      id: projects.id,
      visibility: projects.visibility,
    })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, auth.workspace.id), isNull(projects.archivedAt)))
    .limit(1);

  if (!project) {
    return null;
  }

  if (project.visibility === "workspace") {
    const allowed = canViewProject({
      permissions: auth.workspace.permissions,
      visibility: project.visibility,
      isProjectMember: false,
    });

    if (!allowed) {
      return null;
    }

    return {
      project,
      isProjectMember: false,
    };
  }

  const [membership] = await db
    .select({
      userId: projectMembers.userId,
    })
    .from(projectMembers)
    .where(and(eq(projectMembers.projectId, project.id), eq(projectMembers.userId, auth.user.id)))
    .limit(1);

  const isProjectMember = Boolean(membership);

  const allowed = canViewProject({
    permissions: auth.workspace.permissions,
    visibility: project.visibility,
    isProjectMember,
  });

  if (!allowed) {
    return null;
  }

  return {
    project,
    isProjectMember,
  };
}

export async function filterAccessibleProjects<
  T extends {
    id: string;
    visibility: ProjectVisibility;
  },
>(db: Db, auth: AuthContext, candidateProjects: readonly T[]): Promise<T[]> {
  if (auth.workspace.permissions.includes("projects.private.view_all")) {
    return candidateProjects.filter((project) =>
      canViewProject({
        permissions: auth.workspace.permissions,
        visibility: project.visibility,
        isProjectMember: false,
      }),
    );
  }

  const privateProjectIds = candidateProjects.filter((project) => project.visibility === "private").map((project) => project.id);

  if (privateProjectIds.length === 0) {
    return candidateProjects.filter((project) =>
      canViewProject({
        permissions: auth.workspace.permissions,
        visibility: project.visibility,
        isProjectMember: false,
      }),
    );
  }

  const memberships = await db
    .select({
      projectId: projectMembers.projectId,
    })
    .from(projectMembers)
    .where(and(eq(projectMembers.userId, auth.user.id), inArray(projectMembers.projectId, privateProjectIds)));

  const memberProjectIds = new Set(memberships.map((membership) => membership.projectId));

  return candidateProjects.filter((project) =>
    canViewProject({
      permissions: auth.workspace.permissions,
      visibility: project.visibility,
      isProjectMember: memberProjectIds.has(project.id),
    }),
  );
}
