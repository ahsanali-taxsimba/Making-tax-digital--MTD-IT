"use client";

import { useQuery } from "@tanstack/react-query";
import { listBankAccounts } from "@/lib/reconciliation";

export function useBankAccounts(clientId?: string | null) {
  return useQuery({
    queryKey: ["bank-accounts", clientId],
    queryFn: () => listBankAccounts(clientId!),
    enabled: Boolean(clientId),
  });
}
