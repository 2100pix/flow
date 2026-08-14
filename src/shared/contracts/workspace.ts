import * as z from "zod";

export const updateWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

export type UpdateWorkspaceInput = z.infer<typeof updateWorkspaceSchema>;

export type WorkspaceDto = {
  id: string;
  name: string;
  updatedAt: string;
};

export type WorkspaceResponse = {
  data: WorkspaceDto;
};
