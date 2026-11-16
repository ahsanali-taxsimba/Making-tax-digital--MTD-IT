"use client";

import { useQuery } from "@tanstack/react-query";
import { getBankTransactions } from "@/lib/reconciliation";

export function useBankTransactions(accountId?: string | null) {
  return useQuery({
    queryKey: ["bank-transactions", accountId],
    queryFn: () => getBankTransactions(accountId!),
    enabled: Boolean(accountId),
  });
}
