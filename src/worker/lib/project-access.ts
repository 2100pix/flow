import { and, eq, isNull } from "drizzle-orm";

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

/**
 * Resolve project access without disclosing whether an
 * inaccessible private project exists.
 *
 * null means one of:
 *
 * - project does not exist
 * - project belongs to another workspace
 * - project is archived
 * - caller lacks projects.view
 * - caller cannot access the private project
 */
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
