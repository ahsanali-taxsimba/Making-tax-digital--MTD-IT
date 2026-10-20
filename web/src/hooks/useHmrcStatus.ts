"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listHmrcConnections } from "@/lib/firm";
import { disconnectHmrc, getHmrcStatus, refreshHmrcToken } from "@/lib/hmrc";

export function useHmrcStatus(clientId?: string | null, environment: string = "sandbox") {
  return useQuery({
    queryKey: ["hmrc-status", clientId, environment],
    queryFn: () => getHmrcStatus(clientId!, environment),
    enabled: Boolean(clientId),
    refetchInterval: 60_000,
  });
}

export function useHMRCStatus(clientId?: string | null, environment: string = "sandbox") {
  const overview = useQuery({
    queryKey: ["hmrc-connections"],
    queryFn: listHmrcConnections,
    enabled: !clientId,
  });
  const status = useHmrcStatus(clientId, environment);
  return clientId ? status : overview;
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
