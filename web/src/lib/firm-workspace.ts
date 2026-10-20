import { apiFetch } from "./api";
import type { ClientRecord, FirmRecord } from "./types";

export interface FirmDocumentRow {
  id: string;
  clientId: string;
  fileName: string;
  type?: string | null;
  uploadedAt?: string;
}

export interface FirmVatReturnRow {
  id: string;
  clientId: string;
  periodKey: string;
  status: string;
  createdAt?: string;
}

export interface FirmItsaSubmissionRow {
  id: string;
  clientId: string;
  taxYear: string;
  status: string;
  createdAt?: string;
}

export function getFirmWorkspace() {
  return apiFetch<FirmRecord>("/firm/me");
}

export function listFirmClients() {
  return apiFetch<ClientRecord[]>("/firm/clients");
}

export function getFirmClient(id: string) {
  return apiFetch<ClientRecord>(`/firm/clients/${id}`);
}

export function listFirmDocuments() {
  return apiFetch<FirmDocumentRow[]>("/firm/documents");
}

export function listFirmVatReturns() {
  return apiFetch<FirmVatReturnRow[]>("/firm/vat/returns");
}

export function listFirmItsaSubmissions() {
  return apiFetch<FirmItsaSubmissionRow[]>("/firm/itsa/submissions");
}
