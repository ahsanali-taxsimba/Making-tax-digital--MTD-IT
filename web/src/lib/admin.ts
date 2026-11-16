import { apiFetch } from "./api";

export interface AdminFirmRow {
  id: string;
  name: string;
  slug: string;
  subscriptionPlan: string;
  createdAt?: string;
  totalClients: number;
  totalFirmUsers: number;
  totalVatReturns: number;
  totalItsaSubmissions: number;
}

export interface FeatureFlagRow {
  id: string;
  key: string;
  enabled: boolean;
  description?: string | null;
}

export interface AdminLogRow {
  id: string;
  actionType: string;
  createdAt: string;
  actorUserId?: string | null;
  firmId?: string | null;
}

export function listAdminFirms() {
  return apiFetch<AdminFirmRow[]>("/admin/firms");
}

export function getAdminFirmStats(id: string) {
  return apiFetch<AdminFirmRow>(`/admin/firms/${id}/stats`);
}

export function getAdminHealth() {
  return apiFetch<{ status: string; service: string; scope?: string }>("/admin/system/health");
}

export function listAdminLogs() {
  return apiFetch<AdminLogRow[]>("/admin/logs");
}

export function listFeatureFlags() {
  return apiFetch<FeatureFlagRow[]>("/admin/feature-flags");
}
