"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import {
  digitalLinkResourceId,
  exportAuditTrail,
  getDigitalLinks,
  listAuditLogs,
  type AuditFilters,
  type AuditLogEntry,
} from "@/lib/audit";

export function useAuditLogs(filters: AuditFilters, enabled = true) {
  return useQuery({
    queryKey: ["audit-logs", filters],
    queryFn: () => listAuditLogs(filters),
    enabled,
  });
}

export function useDigitalLinks(entry?: AuditLogEntry | null) {
  const resourceId = entry ? digitalLinkResourceId(entry) : null;
  return useQuery({
    queryKey: ["digital-links", resourceId, entry?.resourceType],
    queryFn: () => getDigitalLinks(resourceId!, entry?.resourceType),
    enabled: Boolean(resourceId),
    retry: false,
  });
}

export function useAuditExport() {
  return useMutation({
    mutationFn: (query: { clientId?: string; period?: string }) => exportAuditTrail(query),
  });
}
