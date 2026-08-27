import * as z from "zod";

import { PROJECT_LEAD_MAX_COUNT } from "../project-constants";

export const projectLeadUserIdSchema = z.string().trim().min(1);

export const projectLeadUserIdsSchema = z
  .array(projectLeadUserIdSchema)
  .min(1)
  .max(PROJECT_LEAD_MAX_COUNT)
  .refine((userIds) => new Set(userIds).size === userIds.length, {
    message: "Project leads must be unique",
  });

export const replaceProjectLeadsSchema = z.object({
  userIds: projectLeadUserIdsSchema,
});

export type ProjectLeadUserIds = z.infer<typeof projectLeadUserIdsSchema>;
export type ReplaceProjectLeadsInput = z.infer<typeof replaceProjectLeadsSchema>;

export type ProjectLeadDto = {
  userId: string;
  position: number;
};

export type ProjectLeadsResponse = {
  data: ProjectLeadDto[];
};
