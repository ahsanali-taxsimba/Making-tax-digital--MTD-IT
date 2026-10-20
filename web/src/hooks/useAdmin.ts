"use client";

import { useQuery } from "@tanstack/react-query";
import { getAdminFirmStats, getAdminHealth, listAdminFirms, listAdminLogs, listFeatureFlags } from "@/lib/admin";

export function useAdminFirms() {
  return useQuery({ queryKey: ["admin-firms"], queryFn: listAdminFirms });
}

export function useAdminFirmStats(id?: string) {
  return useQuery({
    queryKey: ["admin-firm-stats", id],
    queryFn: () => getAdminFirmStats(id!),
    enabled: Boolean(id),
  });
}

export function useAdminHealth() {
  return useQuery({ queryKey: ["admin-health"], queryFn: getAdminHealth, retry: false });
}

export function useAdminLogs() {
  return useQuery({ queryKey: ["admin-logs"], queryFn: listAdminLogs, retry: false });
}

export function useFeatureFlags() {
  return useQuery({ queryKey: ["admin-feature-flags"], queryFn: listFeatureFlags, retry: false });
}
