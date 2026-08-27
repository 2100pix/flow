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

export const createWorkspaceExpertiseSchema = z.object({
  name: z.string().trim().min(1).max(80),
});

export const updateMemberExpertiseSchema = z.object({
  expertiseIds: z.array(z.string().trim().min(1)).max(32),
});

export type CreateWorkspaceExpertiseInput = z.infer<typeof createWorkspaceExpertiseSchema>;
export type UpdateMemberExpertiseInput = z.infer<typeof updateMemberExpertiseSchema>;

export type WorkspaceExpertiseDto = {
  id: string;

  name: string;

  createdAt: string;
};
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;

export type MemberDto = {
  id: string;

  displayName: string;

  firstName: string | null;

  lastName: string | null;

  avatarUrl: string | null;

  role: WorkspaceRole;

  customRole: {
    id: string;

    name: string;
  } | null;

  expertise?: WorkspaceExpertiseDto[];

  joinedAt?: string;
};

export type WorkspaceExpertiseResponse = {
  data: WorkspaceExpertiseDto[];
};

export type WorkspaceExpertiseItemResponse = {
  data: WorkspaceExpertiseDto;
};

export type MemberAccessRequestDto = {
  id: string;
  displayName: string;
  firstName: string | null;
  lastName: string | null;
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
  isLead: boolean;
  leadPosition: number | null;
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

export type RemoveWorkspaceMemberResponse = {
  data: {
    success: true;
  };
};
