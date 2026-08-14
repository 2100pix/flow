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
