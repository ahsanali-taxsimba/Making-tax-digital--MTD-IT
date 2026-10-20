import { apiFetch } from "./api";
import type { ClientRecord } from "./types";

export function listClients() {
  return apiFetch<ClientRecord[]>("/clients");
}
