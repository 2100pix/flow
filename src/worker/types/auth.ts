import type { workspaceMembers } from "../db/schema";

type WorkspaceMember = typeof workspaceMembers.$inferSelect;

export type WorkspaceRole = WorkspaceMember["role"];

export type AuthContext = {
  user: {
    id: string;
    displayName: string;
    avatarUrl: string | null;
  };

  workspace: {
    id: string;
    role: WorkspaceRole;
  };
};
