import * as z from "zod";

import { PROJECT_DESCRIPTION_MAX_LENGTH } from "../project-constants";
import { projectVisibilitySchema, type ProjectVisibility } from "../project-privacy";
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
  clientId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(160),
  projectCodeOverride: projectCodeOverrideSchema.optional(),
  engagementType: projectEngagementTypeSchema.optional(),
  visibility: projectVisibilitySchema.optional(),
  description: projectDescriptionSchema.optional(),
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
    clientId: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1).max(160).optional(),
    projectCodeOverride: projectCodeOverrideSchema.nullable().optional(),
    engagementType: projectEngagementTypeSchema.optional(),
    leadUserId: z.string().trim().min(1).nullable().optional(),
    description: projectDescriptionSchema.nullable().optional(),
    visibility: projectVisibilitySchema.optional(),
    status: projectStatusSchema.optional(),
    startDate: z.iso.date().nullable().optional(),
    dueDate: z.iso.date().nullable().optional(),
    discordChannelUrl: discordChannelUrlSchema.nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one field is required",
  });

export type ProjectEngagementType = z.infer<typeof projectEngagementTypeSchema>;
export type ProjectDueDateMode = z.infer<typeof projectDueDateModeSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ArchiveProjectResponse = {
  data: {
    success: true;
  };
};

export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type ProjectDto = {
  id: string;
  client: {
    id: string;
    name: string;
  };
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
