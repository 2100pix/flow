import * as z from "zod";

export type DiscordReminderSettingsDto = {
  enabled: boolean;

  timeZone: string;

  hourLocal: number;
};

export type DiscordIntegrationDto = {
  enabled: boolean;

  connectionStatus: "disconnected" | "connected";

  guild: {
    id: string;
    name: string;
  } | null;

  projectCategoryId: string | null;

  reminders: DiscordReminderSettingsDto;

  connectedAt: string | null;
};

export type DiscordIntegrationResponse = {
  data: DiscordIntegrationDto;
};

export const updateDiscordIntegrationSchema = z.object({
  enabled: z.boolean(),
});

export type UpdateDiscordIntegrationInput = z.infer<typeof updateDiscordIntegrationSchema>;

export const updateDiscordReminderSettingsSchema = z.object({
  enabled: z.boolean(),

  timeZone: z.string().trim().min(1).max(100),

  hourLocal: z.number().int().min(0).max(23),
});

export type UpdateDiscordReminderSettingsInput = z.infer<typeof updateDiscordReminderSettingsSchema>;

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
