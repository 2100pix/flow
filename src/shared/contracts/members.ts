import * as z from "zod";

export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);

export const addProjectMemberSchema = z.object({
  userId: z.string().trim().min(1),
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export type MemberDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: WorkspaceRole;
};

export type MembersResponse = {
  data: MemberDto[];
};

export type ProjectMemberDto = {
  user: MemberDto;
  addedAt: string;
};

export type ProjectMembersResponse = {
  data: ProjectMemberDto[];
};

export type ProjectMemberResponse = {
  data: ProjectMemberDto;
};

export type RemoveProjectMemberResponse = {
  data: {
    success: true;
  };
};
