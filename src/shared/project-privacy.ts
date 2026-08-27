import * as z from "zod";

import type { PermissionKey } from "./permissions";
export const projectVisibilitySchema = z.enum(["workspace", "private"]);

export type ProjectVisibility = z.infer<typeof projectVisibilitySchema>;
export type ProjectAccessContext = {
  permissions: readonly PermissionKey[];

  visibility: ProjectVisibility;

  isProjectMember: boolean;
};

function hasPermission(permissions: readonly PermissionKey[], permission: PermissionKey) {
  return permissions.includes(permission);
}

/**
 * Base project visibility policy.
 *
 * Workspace permission is always checked first.
 *
 * workspace:
 *   projects.view is enough.
 *
 * private:
 *   requires projects.view plus either:
 *   - explicit project membership
 *   - projects.private.view_all
 */
export function canViewProject({ permissions, visibility, isProjectMember }: ProjectAccessContext) {
  if (!hasPermission(permissions, "projects.view")) {
    return false;
  }

  if (visibility === "workspace") {
    return true;
  }

  return isProjectMember || hasPermission(permissions, "projects.private.view_all");
}

export function canCreateProjectWithVisibility(permissions: readonly PermissionKey[], visibility: ProjectVisibility) {
  if (!hasPermission(permissions, "projects.create")) {
    return false;
  }

  if (visibility === "workspace") {
    return true;
  }

  return hasPermission(permissions, "projects.private.create");
}

export function canManageProjectVisibility(permissions: readonly PermissionKey[]) {
  return hasPermission(permissions, "projects.edit") && hasPermission(permissions, "projects.private.manage");
}

export function canManageProjectMembers(permissions: readonly PermissionKey[], visibility: ProjectVisibility) {
  if (!hasPermission(permissions, "projects.assign")) {
    return false;
  }

  if (visibility === "workspace") {
    return true;
  }

  return hasPermission(permissions, "projects.private.manage");
}
