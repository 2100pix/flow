import type { PermissionKey } from "../../shared/permissions";

import type { workspaceMembers } from "../db/schema";

type WorkspaceMember = typeof workspaceMembers.$inferSelect;

export type WorkspaceRole = WorkspaceMember["role"];

export type AuthContext = {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;

    firstName: string | null;
    lastName: string | null;
    timeZone: string | null;

    expertise: {
      id: string;
      name: string;
    }[];
  };

  workspace: {
    id: string;
    name: string;

    role: WorkspaceRole;
    isCreator: boolean;
    customRole: {
      id: string;
      name: string;
    } | null;

    permissions: PermissionKey[];
  };
};
