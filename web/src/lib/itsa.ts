import { apiFetch } from "./api";
import type { ItsaBusiness, ItsaObligation, ItsaValidation } from "./types";

export function listItsaObligations(clientId: string) {
  const query = new URLSearchParams({ clientId });
  return apiFetch<ItsaObligation[]>(`/itsa/obligations?${query.toString()}`);
}

export function validateItsaUpdate(params: {
  clientId: string;
  businessId?: string;
  taxYear?: string;
  periodId?: string;
  periodStart?: string;
  periodEnd?: string;
  fromLedger?: boolean;
}) {
  const query = new URLSearchParams({ clientId: params.clientId, kind: "quarterly" });
  if (params.businessId) query.set("businessId", params.businessId);
  if (params.taxYear) query.set("taxYear", params.taxYear);
  if (params.periodId) query.set("periodId", params.periodId);
  if (params.periodStart) query.set("periodStart", params.periodStart);
  if (params.periodEnd) query.set("periodEnd", params.periodEnd);
  if (params.fromLedger) query.set("fromLedger", "true");
  return apiFetch<ItsaValidation>(`/itsa/validate?${query.toString()}`);
}

export function listItsaBusinesses(clientId: string) {
  const query = new URLSearchParams({ clientId });
  return apiFetch<ItsaBusiness[]>(`/itsa/businesses?${query.toString()}`);
}

export function submitItsaQuarterlyUpdate(body: {
  clientId: string;
  businessId: string;
  taxYear: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
  fromLedger: boolean;
}) {
  return apiFetch<{ id: string; status: string; validation?: ItsaValidation["validation"] }>(
    "/itsa/quarterly-update",
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  );
}
