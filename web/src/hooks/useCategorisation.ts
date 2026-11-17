"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { applyCategorisationSuggestion, listCategorisationRules, suggestClientCategorisation } from "@/lib/categorisation";

export function useCategorisationSuggestions(clientId?: string | null) {
  return useQuery({
    queryKey: ["categorisation-suggestions", clientId],
    queryFn: () => suggestClientCategorisation(clientId!),
    enabled: Boolean(clientId),
  });
}

export function useCategorisationRules() {
  return useQuery({
    queryKey: ["categorisation-rules"],
    queryFn: listCategorisationRules,
  });
}

export function useApplyCategorisationSuggestion(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyCategorisationSuggestion,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["categorisation-suggestions", clientId] });
      await queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["matching-suggestions"] });
      await queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
    },
  });
}
