import * as z from "zod";

import type { MemberDto } from "./members";

export const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export const updateTeamSchema = createTeamSchema;

export const addTeamMemberSchema = z.object({
  userId: z.string().trim().min(1),
});

export type CreateTeamInput = z.infer<typeof createTeamSchema>;

export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;

export type AddTeamMemberInput = z.infer<typeof addTeamMemberSchema>;

export type TeamMemberDto = {
  user: MemberDto;
  addedAt: string;
};

export type TeamDto = {
  id: string;
  name: string;
  members: TeamMemberDto[];
  createdAt: string;
  updatedAt: string;
};

export type TeamsResponse = {
  data: TeamDto[];
};

export type TeamResponse = {
  data: TeamDto;
};

export type TeamMemberResponse = {
  data: TeamMemberDto;
};

export type DeleteTeamResponse = {
  data: {
    success: true;
  };
};

export type RemoveTeamMemberResponse = {
  data: {
    success: true;
  };
};
