"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listItsaEops, listItsaFinals, listItsaObligations, listItsaUpdates } from "@/lib/itsa";
import { bookkeepingItsaSummary, confirmPortalAction, listTasks } from "@/lib/portal";
import { listVatObligations, listVatReturns, validateVatReturn } from "@/lib/vat";

export function useClientObligations(clientId?: string | null) {
  const vat = useQuery({
    queryKey: ["vat-obligations", clientId],
    queryFn: () => listVatObligations(clientId!),
    enabled: Boolean(clientId),
  });
  const itsa = useQuery({
    queryKey: ["itsa-obligations", clientId],
    queryFn: () => listItsaObligations(clientId!),
    enabled: Boolean(clientId),
  });
  const tasks = useQuery({
    queryKey: ["tasks"],
    queryFn: listTasks,
    enabled: Boolean(clientId),
  });
  return { vat, itsa, tasks };
}

export function useVatReturns(clientId?: string | null) {
  return useQuery({
    queryKey: ["vat-returns", clientId],
    queryFn: () => listVatReturns(clientId!),
    enabled: Boolean(clientId),
  });
}

export function useVatDraft(clientId?: string | null, periodKey?: string, periodStart?: string, periodEnd?: string) {
  return useQuery({
    queryKey: ["vat-draft", clientId, periodKey, periodStart, periodEnd],
    queryFn: () =>
      validateVatReturn({
        clientId: clientId!,
        periodKey,
        periodStart,
        periodEnd,
        fromLedger: true,
      }),
    enabled: Boolean(clientId && (periodKey || (periodStart && periodEnd))),
  });
}

export function useItsaSubmissions(clientId?: string | null) {
  const updates = useQuery({
    queryKey: ["itsa-updates", clientId],
    queryFn: () => listItsaUpdates(clientId!),
    enabled: Boolean(clientId),
  });
  const eops = useQuery({
    queryKey: ["itsa-eops", clientId],
    queryFn: () => listItsaEops(clientId!),
    enabled: Boolean(clientId),
  });
  const finals = useQuery({
    queryKey: ["itsa-finals", clientId],
    queryFn: () => listItsaFinals(clientId!),
    enabled: Boolean(clientId),
  });
  return { updates, eops, finals };
}

export function usePropertyIncome(clientId?: string | null, periodStart?: string, periodEnd?: string) {
  return useQuery({
    queryKey: ["itsa-property-income", clientId, periodStart, periodEnd],
    queryFn: () =>
      bookkeepingItsaSummary({
        clientId: clientId!,
        businessType: "property",
        periodStart,
        periodEnd,
      }),
    enabled: Boolean(clientId),
  });
}

export function useConfirmPortal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, note }: { kind: "vat" | "itsa" | "records"; note?: string }) => confirmPortalAction(kind, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["messages"] });
    },
  });
}
