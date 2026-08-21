import * as z from "zod";

export const taskResourceTypeSchema = z.enum(["document_brief", "link"]);

export const taskResourceUrlSchema = z.url().refine(
  (value) => {
    const url = new URL(value);

    return url.protocol === "https:" || url.protocol === "http:";
  },
  {
    message: "Resource URL must use HTTP or HTTPS",
  },
);

const taskResourceTitleSchema = z.string().trim().min(1);

export const createTaskResourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("document_brief"),

    title: taskResourceTitleSchema.optional(),

    content: z.string().optional(),
  }),

  z.object({
    type: z.literal("link"),

    title: taskResourceTitleSchema.optional(),

    url: taskResourceUrlSchema,
  }),
]);

export const updateTaskResourceSchema = z
  .object({
    title: taskResourceTitleSchema.nullable().optional(),

    url: taskResourceUrlSchema.nullable().optional(),

    content: z.string().nullable().optional(),
  })
  .refine((value) => Object.values(value).some((item) => item !== undefined), {
    message: "At least one resource field is required",
  });

export type TaskResourceType = z.infer<typeof taskResourceTypeSchema>;

export type CreateTaskResourceInput = z.infer<typeof createTaskResourceSchema>;

export type UpdateTaskResourceInput = z.infer<typeof updateTaskResourceSchema>;

export type TaskResourceDto = {
  id: string;
  taskId: string;

  type: TaskResourceType;

  title: string | null;
  url: string | null;
  content: string | null;

  position: number;

  createdBy: string;

  createdAt: string;
  updatedAt: string;
};

export type TaskResourcesResponse = {
  data: TaskResourceDto[];
};

export type TaskResourceResponse = {
  data: TaskResourceDto;
};

export type DeleteTaskResourceResponse = {
  data: {
    success: true;
  };
};
