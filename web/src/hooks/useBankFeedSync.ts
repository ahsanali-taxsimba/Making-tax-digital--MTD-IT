"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { syncBankFeed } from "@/lib/yapily-feed";

export function useBankFeedSync(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: { bankAccountId?: string; autoPost?: boolean }) =>
      syncBankFeed({ clientId: clientId!, bankAccountId: input?.bankAccountId, autoPost: input?.autoPost }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
      await queryClient.invalidateQueries({ queryKey: ["bank-transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["matching-suggestions"] });
      await queryClient.invalidateQueries({ queryKey: ["categorisation-suggestions"] });
      await queryClient.invalidateQueries({ queryKey: ["reconciliation-suggestions"] });
      await queryClient.invalidateQueries({ queryKey: ["reconciliation-summary"] });
    },
  });
}
