"use client";

import { useQuery } from "@tanstack/react-query";
import { listClientBankLines } from "@/lib/reconciliation";

export function useClientBankLines(clientId?: string | null) {
  return useQuery({
    queryKey: ["client-bank-lines", clientId],
    queryFn: () => listClientBankLines(clientId!),
    enabled: Boolean(clientId),
  });
}
