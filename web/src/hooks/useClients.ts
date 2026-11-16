"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient, listClients, updateClient } from "@/lib/clients";
import type { ClientType, RiskLevel } from "@/lib/types";

export function useClients(enabled = true) {
  return useQuery({
    queryKey: ["clients"],
    queryFn: listClients,
    enabled,
  });
}

export function useCreateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: {
      name: string;
      type: ClientType;
      utr?: string;
      vatRegistrationNumber?: string;
      nino?: string;
      riskLevel?: RiskLevel;
      assignedUserId?: string;
    }) => createClient(body),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["firm-dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["hmrc-connections"] });
    },
  });
}

export function useUpdateClient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; assignedUserId?: string | null; riskLevel?: RiskLevel; name?: string }) =>
      updateClient(input.id, input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["clients"] });
      await queryClient.invalidateQueries({ queryKey: ["firm-dashboard"] });
    },
  });
}
