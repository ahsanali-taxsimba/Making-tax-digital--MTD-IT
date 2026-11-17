"use client";

import { useQuery } from "@tanstack/react-query";
import { listVatObligations } from "@/lib/vat";

export function useVatObligations(clientId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["vat-obligations", clientId],
    queryFn: () => listVatObligations(clientId!),
    enabled: Boolean(clientId) && enabled,
  });
}
