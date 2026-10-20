import { apiFetch } from "./api";
import type { VatObligation, VatReturnRecord, VatValidation } from "./types";

export function listVatReturns(clientId: string) {
  const query = new URLSearchParams({ clientId });
  return apiFetch<VatReturnRecord[]>(`/vat/returns?${query.toString()}`);
}

export function listVatObligations(clientId: string) {
  const query = new URLSearchParams({ clientId });
  return apiFetch<VatObligation[]>(`/vat/obligations?${query.toString()}`);
}

export function validateVatReturn(params: {
  clientId: string;
  periodKey?: string;
  periodStart?: string;
  periodEnd?: string;
  fromLedger?: boolean;
}) {
  const query = new URLSearchParams({ clientId: params.clientId });
  if (params.periodKey) query.set("periodKey", params.periodKey);
  if (params.periodStart) query.set("periodStart", params.periodStart);
  if (params.periodEnd) query.set("periodEnd", params.periodEnd);
  if (params.fromLedger) query.set("fromLedger", "true");
  return apiFetch<VatValidation>(`/vat/validate?${query.toString()}`);
}
