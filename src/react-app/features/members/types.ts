export type {
  AddProjectMemberInput,
  MemberDto,
  MemberResponse,
  MembersResponse,
  ProjectMemberDto,
  ProjectMemberResponse,
  ProjectMembersResponse,
  RemoveProjectMemberResponse,
  UpdateWorkspaceMemberRoleInput,
  WorkspaceRole,
} from "../../../shared/contracts/members";

export type MemberAccessRequestDto = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  requestedAt: string;
};

export type MemberAccessRequestsResponse = {
  data: MemberAccessRequestDto[];
};
