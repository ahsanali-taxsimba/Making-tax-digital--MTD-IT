"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  completeCheckout,
  createBillingPlan,
  getBillingMetrics,
  getBillingSubscription,
  listAdminBillingPlans,
  listBillingInvoices,
  listBillingPlans,
  listBillingSubscribers,
  openBillingPortal,
  startCheckout,
  updateBillingPlan,
  type BillingPlan,
} from "@/lib/billing";

export function useBillingPlans() {
  return useQuery({ queryKey: ["billing-plans"], queryFn: listBillingPlans });
}

export function useBillingSubscription() {
  return useQuery({ queryKey: ["billing-subscription"], queryFn: getBillingSubscription });
}

export function useBillingInvoices() {
  return useQuery({ queryKey: ["billing-invoices"], queryFn: listBillingInvoices });
}

export function useCheckout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ planSlug, vatNumber }: { planSlug: string; vatNumber?: string }) => startCheckout(planSlug, vatNumber),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["billing-subscription"] });
    },
  });
}

export function useCompleteCheckout() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: completeCheckout,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["billing-subscription"] });
      void client.invalidateQueries({ queryKey: ["billing-invoices"] });
    },
  });
}

export function useBillingPortal() {
  return useMutation({ mutationFn: openBillingPortal });
}

export function useAdminBillingMetrics() {
  return useQuery({ queryKey: ["admin-billing-metrics"], queryFn: getBillingMetrics });
}

export function useAdminBillingPlans() {
  return useQuery({ queryKey: ["admin-billing-plans"], queryFn: listAdminBillingPlans });
}

export function useAdminBillingSubscribers() {
  return useQuery({ queryKey: ["admin-billing-subscribers"], queryFn: listBillingSubscribers });
}

export function useUpdateBillingPlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<BillingPlan> }) => updateBillingPlan(id, body),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin-billing-plans"] });
      void client.invalidateQueries({ queryKey: ["admin-billing-metrics"] });
    },
  });
}

export function useCreateBillingPlan() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createBillingPlan,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["admin-billing-plans"] });
    },
  });
}
