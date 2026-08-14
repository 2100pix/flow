import * as z from "zod";

export const projectStatusSchema = z.enum(["planning", "active", "on_hold", "completed"]);

export const createProjectSchema = z.object({
  clientId: z.string().trim().min(1),

  name: z.string().trim().min(1).max(160),
});

export type ProjectStatus = z.infer<typeof projectStatusSchema>;

export type CreateProjectInput = z.infer<typeof createProjectSchema>;

export type ProjectDto = {
  id: string;

  client: {
    id: string;
    name: string;
  };

  name: string;
  description: string | null;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  discordChannelUrl: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsResponse = {
  data: ProjectDto[];
};

export type ProjectResponse = {
  data: ProjectDto;
};
