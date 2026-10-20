"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { disconnectHmrc, getHmrcStatus, refreshHmrcToken } from "@/lib/hmrc";

export function useHmrcStatus(clientId?: string | null, environment: string = "sandbox") {
  return useQuery({
    queryKey: ["hmrc-status", clientId, environment],
    queryFn: () => getHmrcStatus(clientId!, environment),
    enabled: Boolean(clientId),
    refetchInterval: 60_000,
  });
}

export function useDisconnectHmrc(clientId?: string | null, environment: string = "sandbox") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => disconnectHmrc(clientId!, environment),
    onSuccess: (data) => {
      queryClient.setQueryData(["hmrc-status", clientId, environment], data);
      void queryClient.invalidateQueries({ queryKey: ["vat-obligations", clientId] });
      void queryClient.invalidateQueries({ queryKey: ["itsa-obligations", clientId] });
    },
  });
}

export function useRefreshHmrc(clientId?: string | null, environment: string = "sandbox") {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => refreshHmrcToken(clientId!, environment),
    onSuccess: (data) => {
      queryClient.setQueryData(["hmrc-status", clientId, environment], data);
    },
  });
}
