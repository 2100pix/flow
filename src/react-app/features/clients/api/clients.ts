import { apiFetch } from "@/lib/api";

import type { ClientResponse, ClientsResponse, CreateClientInput } from "../types";

export async function getClients() {
  const response = await apiFetch<ClientsResponse>("/api/clients");

  return response.data;
}

export async function createClient(input: CreateClientInput) {
  const response = await apiFetch<ClientResponse>("/api/clients", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}
