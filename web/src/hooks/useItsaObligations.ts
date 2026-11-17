"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listItsaObligations, submitItsaQuarterlyUpdate, validateItsaUpdate } from "@/lib/itsa";

export function useItsaObligations(clientId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["itsa-obligations", clientId],
    queryFn: () => listItsaObligations(clientId!),
    enabled: Boolean(clientId) && enabled,
  });
}

export function useItsaValidation(params: {
  clientId?: string | null;
  businessId?: string;
  taxYear?: string;
  periodId?: string;
  periodStart?: string;
  periodEnd?: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: [
      "itsa-validate",
      params.clientId,
      params.businessId,
      params.taxYear,
      params.periodId,
      params.periodStart,
      params.periodEnd,
    ],
    queryFn: () =>
      validateItsaUpdate({
        clientId: params.clientId!,
        businessId: params.businessId,
        taxYear: params.taxYear,
        periodId: params.periodId,
        periodStart: params.periodStart,
        periodEnd: params.periodEnd,
        fromLedger: true,
      }),
    enabled: Boolean(params.clientId && params.businessId && params.periodStart && params.periodEnd) && params.enabled !== false,
  });
}

export function useSubmitItsaQuarterly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: submitItsaQuarterlyUpdate,
    onSuccess: (_data, vars) => {
      void queryClient.invalidateQueries({ queryKey: ["itsa-obligations", vars.clientId] });
      void queryClient.invalidateQueries({ queryKey: ["itsa-validate", vars.clientId] });
    },
  });
}
