import type { PermissionKey } from "../../../shared/permissions";

import type { AuthContext } from "./types";

export function hasPermission(auth: AuthContext | null | undefined, permission: PermissionKey) {
  return Boolean(auth?.workspace.permissions.includes(permission));
}
