import { apiFetch } from "./api";
import type { ClientRecord, ClientType, RiskLevel } from "./types";

export function listClients() {
  return apiFetch<ClientRecord[]>("/clients");
}

export function getMyClient() {
  return apiFetch<ClientRecord>("/clients/me");
}

export function getClient(clientId: string) {
  return apiFetch<ClientRecord>(`/clients/${clientId}`);
}

export function createClient(body: {
  name: string;
  type: ClientType;
  utr?: string;
  vatRegistrationNumber?: string;
  nino?: string;
  riskLevel?: RiskLevel;
  assignedUserId?: string;
}) {
  return apiFetch<ClientRecord>("/clients", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateClient(
  id: string,
  body: { name?: string; assignedUserId?: string | null; riskLevel?: RiskLevel },
) {
  return apiFetch<ClientRecord>(`/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
