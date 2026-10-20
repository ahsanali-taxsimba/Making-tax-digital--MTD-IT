import { apiFetch } from "./api";
import type { BookkeepingItsaSummary, PortalDocument, PortalMessage, PortalTask } from "./types";

export function scopedQuery(clientId?: string | null): string {
  return clientId ? `?clientId=${clientId}` : "";
}

export function listDocuments(_clientId?: string | null) {
  return apiFetch<PortalDocument[]>(`/portal/documents`);
}

export function uploadDocument(body: {
  clientId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category?: string;
}) {
  return apiFetch<PortalDocument>("/portal/documents", {
    method: "POST",
    body: JSON.stringify({
      fileName: body.fileName,
      mimeType: body.mimeType,
      sizeBytes: body.sizeBytes,
      category: body.category,
    }),
  });
}

export function listMessages(clientId?: string | null) {
  return apiFetch<PortalMessage[]>(`/messages${scopedQuery(clientId)}`);
}

export function sendMessage(body: string, clientId?: string | null) {
  return apiFetch<PortalMessage>("/messages", {
    method: "POST",
    body: JSON.stringify({ body, ...(clientId ? { clientId } : {}) }),
  });
}

export function listTasks() {
  return apiFetch<PortalTask[]>("/tasks");
}

export function confirmPortalAction(kind: "vat" | "itsa" | "records", note?: string) {
  return apiFetch<{ confirmed: boolean; kind: string; tasksUpdated: number }>("/portal/confirm", {
    method: "POST",
    body: JSON.stringify({ kind, note }),
  });
}

export function bookkeepingItsaSummary(params: {
  clientId: string;
  businessType: string;
  periodStart?: string;
  periodEnd?: string;
}) {
  const query = new URLSearchParams({ clientId: params.clientId, businessType: params.businessType });
  if (params.periodStart) query.set("periodStart", params.periodStart);
  if (params.periodEnd) query.set("periodEnd", params.periodEnd);
  return apiFetch<BookkeepingItsaSummary>(`/bookkeeping/itsa/summary?${query.toString()}`);
}
