"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listMessages, sendMessage } from "@/lib/portal";

export function useMessages(clientId?: string | null) {
  return useQuery({
    queryKey: ["messages", clientId],
    queryFn: () => listMessages(clientId),
    enabled: Boolean(clientId),
    refetchInterval: 30_000,
  });
}

export function useSendMessage(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: string) => sendMessage(body, clientId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["messages", clientId] });
    },
  });
}
