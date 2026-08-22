import * as z from "zod";

export type DiscordIntegrationDto = {
  enabled: boolean;

  connectionStatus: "disconnected" | "connected";

  guild: {
    id: string;
    name: string;
  } | null;

  projectCategoryId: string | null;

  connectedAt: string | null;
};

export type DiscordIntegrationResponse = {
  data: DiscordIntegrationDto;
};

export const updateDiscordIntegrationSchema = z.object({
  enabled: z.boolean(),
});

export type UpdateDiscordIntegrationInput = z.infer<typeof updateDiscordIntegrationSchema>;

export type DiscordCategoryDto = {
  id: string;
  name: string;
  position: number;
};

export type DiscordCategoriesResponse = {
  data: DiscordCategoryDto[];
};

export const updateDiscordProjectCategorySchema = z.object({
  projectCategoryId: z.string().trim().regex(/^\d+$/).nullable(),
});

export type UpdateDiscordProjectCategoryInput = z.infer<typeof updateDiscordProjectCategorySchema>;
