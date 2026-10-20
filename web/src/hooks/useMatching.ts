"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyMatchingSuggestion, listMatchingSuggestions, rejectMatchingSuggestion } from "@/lib/matching";

export function useMatchingSuggestions(query: { clientId?: string | null; bankAccountId?: string | null }) {
  return useQuery({
    queryKey: ["matching-suggestions", query.clientId, query.bankAccountId],
    queryFn: () =>
      listMatchingSuggestions({
        clientId: query.clientId ?? undefined,
        bankAccountId: query.bankAccountId ?? undefined,
      }),
    enabled: Boolean(query.clientId || query.bankAccountId),
  });
}

function useInvalidateMatching(clientId?: string | null) {
  const queryClient = useQueryClient();
  return async () => {
    await queryClient.invalidateQueries({ queryKey: ["matching-suggestions"] });
    await queryClient.invalidateQueries({ queryKey: ["categorisation-suggestions", clientId] });
    await queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    await queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
    await queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
    await queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] });
  };
}

export function useApplyMatching(clientId?: string | null) {
  const invalidate = useInvalidateMatching(clientId);
  return useMutation({
    mutationFn: (suggestionId: string) => applyMatchingSuggestion(suggestionId),
    onSuccess: invalidate,
  });
}

export function useRejectMatching(clientId?: string | null) {
  const invalidate = useInvalidateMatching(clientId);
  return useMutation({
    mutationFn: (suggestionId: string) => rejectMatchingSuggestion(suggestionId),
    onSuccess: invalidate,
  });
}
