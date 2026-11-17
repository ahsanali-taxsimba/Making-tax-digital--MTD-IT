import { apiFetch } from "./api";
import type { ClientRecord, ItsaObligation, PortalDocument, VatObligation } from "./types";

export interface ClientObligations {
  vat: VatObligation[];
  itsa: ItsaObligation[];
}

export function getClientWorkspaceMe() {
  return apiFetch<ClientRecord>("/client/me");
}

export function listClientWorkspaceDocuments() {
  return apiFetch<PortalDocument[]>("/client/documents");
}

export function listClientWorkspaceObligations() {
  return apiFetch<ClientObligations>("/client/obligations");
}
