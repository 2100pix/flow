import * as z from "zod";

export const projectResourceTypeSchema = z.enum(["document_brief", "link"]);

export const projectResourceUrlSchema = z.url().refine(
  (value) => {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  },
  {
    message: "Resource URL must use HTTP or HTTPS",
  },
);

const projectResourceTitleSchema = z.string().trim().min(1);

export const createProjectResourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("document_brief"),
    title: projectResourceTitleSchema.optional(),
    content: z.string().optional(),
  }),

  z.object({
    type: z.literal("link"),
    title: projectResourceTitleSchema.optional(),
    url: projectResourceUrlSchema,
  }),
]);

export const updateProjectResourceSchema = z
  .object({
    title: projectResourceTitleSchema.nullable().optional(),
    url: projectResourceUrlSchema.nullable().optional(),
    content: z.string().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one resource field is required",
  });

export type ProjectResourceType = z.infer<typeof projectResourceTypeSchema>;
export type CreateProjectResourceInput = z.infer<typeof createProjectResourceSchema>;
export type UpdateProjectResourceInput = z.infer<typeof updateProjectResourceSchema>;

export type ProjectResourceDto = {
  id: string;
  projectId: string;
  type: ProjectResourceType;
  title: string | null;
  url: string | null;
  content: string | null;
  position: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectResourcesResponse = {
  data: ProjectResourceDto[];
};

export type ProjectResourceResponse = {
  data: ProjectResourceDto;
};
