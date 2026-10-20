import { apiFetch } from "./api";
import type { FirmDashboard, FirmRecord, HmrcConnectionOverview } from "./types";

export function getFirm() {
  return apiFetch<FirmRecord>("/firms/me");
}

export function getFirmDashboard() {
  return apiFetch<FirmDashboard>("/firms/me/dashboard");
}

export function listHmrcConnections() {
  return apiFetch<HmrcConnectionOverview[]>("/firms/me/hmrc");
}
