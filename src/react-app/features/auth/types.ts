import type { PermissionKey } from "../../../shared/permissions";

export type WorkspaceRole = "owner" | "admin" | "member";

export type AuthContext = {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };

  workspace: {
    id: string;
    name: string;

    role: WorkspaceRole;

    customRole: {
      id: string;
      name: string;
    } | null;

    permissions: PermissionKey[];
  };
};

export type MeResponse = {
  data: AuthContext;
};

export type LogoutResponse = {
  data: {
    success: true;
  };
};

export type { PendingAccessContinueResponse } from "../../../shared/contracts/auth";
