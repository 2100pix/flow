import * as z from "zod";

export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);

export const addProjectMemberSchema = z.object({
  userId: z.string().trim().min(1),
});
export const updateWorkspaceMemberRoleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("built_in"),
    role: workspaceRoleSchema,
  }),

  z.object({
    kind: z.literal("custom"),
    roleId: z.string().trim().min(1),
  }),
]);

export type UpdateWorkspaceMemberRoleInput = z.infer<typeof updateWorkspaceMemberRoleSchema>;

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;

export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export type MemberDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;

  role: WorkspaceRole;

  customRole: {
    id: string;
    name: string;
  } | null;
};

export type MemberAccessRequestDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  requestedAt: string;
};

export type MemberAccessRequestsResponse = {
  data: MemberAccessRequestDto[];
};

export type RejectMemberAccessRequestResponse = {
  data: {
    success: true;
  };
};

export type MemberResponse = {
  data: MemberDto;
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
