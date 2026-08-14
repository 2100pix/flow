import { apiFetch } from "@/lib/api";

import type { ArchiveClientResponse, ClientResponse, ClientsResponse, CreateClientInput, UpdateClientInput } from "../types";

export async function getClient(clientId: string) {
  const response = await apiFetch<ClientResponse>(`/api/clients/${clientId}`);

  return response.data;
}

export async function updateClient(clientId: string, input: UpdateClientInput) {
  const response = await apiFetch<ClientResponse>(`/api/clients/${clientId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });

  return response.data;
}

export async function archiveClient(clientId: string) {
  return apiFetch<ArchiveClientResponse>(`/api/clients/${clientId}`, {
    method: "DELETE",
  });
}

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
