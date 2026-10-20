import { apiFetch } from "./api";
import type { ClientRecord } from "./types";

export function listClients() {
  return apiFetch<ClientRecord[]>("/clients");
}

export function getMyClient() {
  return apiFetch<ClientRecord>("/clients/me");
}

export function getClient(clientId: string) {
  return apiFetch<ClientRecord>(`/clients/${clientId}`);
}
