import * as z from "zod";

import { PROJECT_DESCRIPTION_MAX_LENGTH } from "../project-constants";
import { projectVisibilitySchema, type ProjectVisibility } from "../project-privacy";
import { projectLeadUserIdsSchema } from "./project-leads";

export const projectStatusSchema = z.enum(["planning", "active", "on_hold", "completed"]);

export const projectEngagementTypeSchema = z.enum(["project", "retainer"]);
export const projectDueDateModeSchema = z.enum(["unset", "date", "ongoing"]);
export const projectDescriptionSchema = z.string().trim().max(PROJECT_DESCRIPTION_MAX_LENGTH);

export const projectCodeOverrideSchema = z
  .string()
  .trim()
  .min(1)
  .max(8)
  .regex(/^[A-Za-z0-9]+$/)
  .transform((value) => value.toUpperCase());

export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: projectDescriptionSchema.optional(),
  visibility: projectVisibilitySchema.optional(),
  leadUserIds: projectLeadUserIdsSchema.optional(),
});

export const discordChannelUrlSchema = z.url().refine(
  (value) => {
    const url = new URL(value);

    return url.protocol === "https:" && (url.hostname === "discord.com" || url.hostname === "www.discord.com") && url.pathname.startsWith("/channels/");
  },
  {
    message: "Must be a Discord channel URL",
  },
);

export const updateProjectSchema = z
  .object({
    clientId: z.string().trim().min(1).nullable().optional(),
    name: z.string().trim().min(1).max(160).optional(),
    projectCodeOverride: projectCodeOverrideSchema.nullable().optional(),
    engagementType: projectEngagementTypeSchema.optional(),
    description: projectDescriptionSchema.nullable().optional(),
    visibility: projectVisibilitySchema.optional(),
    status: projectStatusSchema.optional(),
    startDate: z.iso.date().nullable().optional(),
    dueDate: z.iso.date().nullable().optional(),
    dueDateMode: projectDueDateModeSchema.optional(),
    discordChannelUrl: discordChannelUrlSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  });

export type ProjectEngagementType = z.infer<typeof projectEngagementTypeSchema>;
export type ProjectDueDateMode = z.infer<typeof projectDueDateModeSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectActionResponse = {
  data: {
    success: true;
  };
};

export type ArchiveProjectResponse = ProjectActionResponse;

export type DeleteProjectResponse = ProjectActionResponse;

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ProjectDto = {
  id: string;
  client: {
    id: string;
    name: string;
  } | null;
  name: string;
  projectCode: string;
  projectCodeOverride: string | null;
  description: string | null;
  engagementType: ProjectEngagementType;
  leadUserId: string | null;
  visibility: ProjectVisibility;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  dueDateMode: ProjectDueDateMode;
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
