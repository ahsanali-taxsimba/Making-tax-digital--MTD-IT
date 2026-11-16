"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyCategorisation,
  getReconciliationSuggestions,
  getReconciliationSummary,
  ignoreBankTransaction,
  matchBankTransaction,
  splitBankTransaction,
  suggestCategorisation,
} from "@/lib/reconciliation";

export function useReconciliationSuggestions(accountId?: string | null) {
  return useQuery({
    queryKey: ["reconciliation-suggestions", accountId],
    queryFn: () => getReconciliationSuggestions({ bankAccountId: accountId! }),
    enabled: Boolean(accountId),
  });
}

export function useReconciliationSummary(accountId?: string | null, statementBalance?: number) {
  return useQuery({
    queryKey: ["reconciliation-summary", accountId, statementBalance],
    queryFn: () => getReconciliationSummary({ bankAccountId: accountId!, statementBalance }),
    enabled: Boolean(accountId),
  });
}

export function useCategorisationSuggestion(bankTransactionId?: string | null) {
  return useQuery({
    queryKey: ["categorisation-suggestion", bankTransactionId],
    queryFn: () => suggestCategorisation(bankTransactionId!),
    enabled: Boolean(bankTransactionId),
  });
}

function useInvalidateBank(accountId?: string | null) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    await queryClient.invalidateQueries({ queryKey: ["bank-transactions", accountId] });
    await queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions", accountId] });
    await queryClient.invalidateQueries({ queryKey: ["reconciliation-summary", accountId] });
    await queryClient.invalidateQueries({ queryKey: ["categorisation-suggestion"] });
  };
}

export function useMatchBank(accountId?: string | null) {
  const invalidate = useInvalidateBank(accountId);
  return useMutation({
    mutationFn: (input: { bankTransactionId: string; journalEntryId: string }) =>
      matchBankTransaction(input.bankTransactionId, input.journalEntryId),
    onSuccess: invalidate,
  });
}

export function useIgnoreBank(accountId?: string | null) {
  const invalidate = useInvalidateBank(accountId);
  return useMutation({
    mutationFn: (bankTransactionId: string) => ignoreBankTransaction(bankTransactionId),
    onSuccess: invalidate,
  });
}

export function useSplitBank(accountId?: string | null) {
  const invalidate = useInvalidateBank(accountId);
  return useMutation({
    mutationFn: (input: { bankTransactionId: string; allocations: Array<{ ledgerAccountId: string; amount: number; description?: string }> }) =>
      splitBankTransaction(input.bankTransactionId, input.allocations),
    onSuccess: invalidate,
  });
}

export function useApplyCategorisation(accountId?: string | null) {
  const invalidate = useInvalidateBank(accountId);
  return useMutation({
    mutationFn: (bankTransactionId: string) => applyCategorisation(bankTransactionId),
    onSuccess: invalidate,
  });
}
