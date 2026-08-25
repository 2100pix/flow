import { apiFetch } from "@/lib/api";

import type { UpdateDiscordReminderSettingsInput, DiscordCategoriesResponse, DiscordIntegrationResponse, DiscordRolesResponse, UpdateDiscordIntegrationInput, UpdateDiscordProjectCategoryInput, UpdateDiscordWorkspaceRoleInput } from "../types";

export async function getDiscordCategories() {
  const response = await apiFetch<DiscordCategoriesResponse>("/api/integrations/discord/categories");

  return response.data;
}

export async function getDiscordRoles() {
  const response = await apiFetch<DiscordRolesResponse>("/api/integrations/discord/roles");

  return response.data;
}

export async function updateDiscordWorkspaceRole(input: UpdateDiscordWorkspaceRoleInput) {
  const response = await apiFetch<DiscordIntegrationResponse>("/api/integrations/discord/workspace-role", {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateDiscordProjectCategory(input: UpdateDiscordProjectCategoryInput) {
  const response = await apiFetch<DiscordIntegrationResponse>("/api/integrations/discord/category", {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateDiscordReminderSettings(input: UpdateDiscordReminderSettingsInput) {
  const response = await apiFetch<DiscordIntegrationResponse>("/api/integrations/discord/reminders", {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function updateDiscordIntegration(input: UpdateDiscordIntegrationInput) {
  const response = await apiFetch<DiscordIntegrationResponse>("/api/integrations/discord", {
    method: "PATCH",

    headers: {
      "Content-Type": "application/json",
    },

    body: JSON.stringify(input),
  });

  return response.data;
}

export async function getDiscordIntegration() {
  const response = await apiFetch<DiscordIntegrationResponse>("/api/integrations/discord");

  return response.data;
}

export async function disconnectDiscordIntegration() {
  const response = await apiFetch<DiscordIntegrationResponse>("/api/integrations/discord", {
    method: "DELETE",
  });

  return response.data;
}
