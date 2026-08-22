import { apiFetch } from "@/lib/api";

import type { DiscordCategoriesResponse, DiscordIntegrationResponse, UpdateDiscordIntegrationInput, UpdateDiscordProjectCategoryInput } from "../types";

export async function getDiscordCategories() {
  const response = await apiFetch<DiscordCategoriesResponse>("/api/integrations/discord/categories");

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
