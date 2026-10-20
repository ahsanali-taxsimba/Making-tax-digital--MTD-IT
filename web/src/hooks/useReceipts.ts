"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import {
  attachReceipt,
  detachReceipt,
  fetchReceiptFile,
  getReceipt,
  listBankTransactionReceipts,
  listBillReceipts,
  listInvoiceReceipts,
  listJournalEntries,
  listJournalReceipts,
  listPurchaseBills,
  listReceiptAudit,
  listReceipts,
  listReceiptTags,
  listSalesInvoices,
  receiptEvidence,
  receiptSuggestions,
  updateReceiptTags,
  uploadReceipt,
  type AttachTarget,
} from "@/lib/receipts";

function invalidateReceipts(queryClient: ReturnType<typeof useQueryClient>, clientId?: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["receipts", clientId] }),
    queryClient.invalidateQueries({ queryKey: ["receipt"] }),
    queryClient.invalidateQueries({ queryKey: ["receipts-target"] }),
    queryClient.invalidateQueries({ queryKey: ["receipt-evidence", clientId] }),
    queryClient.invalidateQueries({ queryKey: ["receipt-suggestions"] }),
    queryClient.invalidateQueries({ queryKey: ["receipt-audit", clientId] }),
  ]);
}

export function useClientReceipts(clientId?: string | null) {
  return useQuery({
    queryKey: ["receipts", clientId],
    queryFn: () => listReceipts(clientId!),
    enabled: Boolean(clientId),
  });
}

export function useReceipt(id?: string | null) {
  return useQuery({
    queryKey: ["receipt", id],
    queryFn: () => getReceipt(id!),
    enabled: Boolean(id),
  });
}

export function useReceiptFile(id?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["receipt-file", id],
    queryFn: () => fetchReceiptFile(id!),
    enabled: Boolean(id) && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useReceiptSuggestions(id?: string | null) {
  return useQuery({
    queryKey: ["receipt-suggestions", id],
    queryFn: () => receiptSuggestions(id!),
    enabled: Boolean(id),
  });
}

export function useReceiptTags() {
  return useQuery({
    queryKey: ["receipt-tags"],
    queryFn: listReceiptTags,
  });
}

export function useTargetReceipts(target: { kind: "bank" | "invoice" | "bill" | "journal"; id?: string | null }) {
  return useQuery({
    queryKey: ["receipts-target", target.kind, target.id],
    queryFn: () => {
      if (target.kind === "invoice") {
        return listInvoiceReceipts(target.id!);
      }
      if (target.kind === "bill") {
        return listBillReceipts(target.id!);
      }
      if (target.kind === "journal") {
        return listJournalReceipts(target.id!);
      }
      return listBankTransactionReceipts(target.id!);
    },
    enabled: Boolean(target.id),
  });
}

export function useReceiptEvidence(clientId?: string | null) {
  return useQuery({
    queryKey: ["receipt-evidence", clientId],
    queryFn: () => receiptEvidence(clientId!),
    enabled: Boolean(clientId),
  });
}

export function useReceiptDocuments(clientId?: string | null) {
  const invoices = useQuery({
    queryKey: ["sales-invoices", clientId],
    queryFn: () => listSalesInvoices(clientId!),
    enabled: Boolean(clientId),
  });
  const bills = useQuery({
    queryKey: ["purchase-bills", clientId],
    queryFn: () => listPurchaseBills(clientId!),
    enabled: Boolean(clientId),
  });
  const journals = useQuery({
    queryKey: ["journal-entries", clientId],
    queryFn: () => listJournalEntries(clientId!),
    enabled: Boolean(clientId),
  });
  return { invoices, bills, journals };
}

export function useReceiptActivity(clientId?: string | null, receiptId?: string | null) {
  return useQuery({
    queryKey: ["receipt-audit", clientId, receiptId],
    queryFn: async () => {
      try {
        return await listReceiptAudit(clientId!);
      } catch (error) {
        if (error instanceof ApiError && (error.status === 403 || error.status === 401)) {
          return [];
        }
        throw error;
      }
    },
    enabled: Boolean(clientId && receiptId),
  });
}

export function useUploadReceipt(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadReceipt,
    onSuccess: async () => {
      await invalidateReceipts(queryClient, clientId);
    },
  });
}

export function useAttachReceipt(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ receiptId, target }: { receiptId: string; target: AttachTarget }) => attachReceipt(receiptId, target),
    onSuccess: async () => {
      await invalidateReceipts(queryClient, clientId);
    },
  });
}

export function useDetachReceipt(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: detachReceipt,
    onSuccess: async () => {
      await invalidateReceipts(queryClient, clientId);
    },
  });
}

export function useUpdateReceiptTags(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, tags }: { id: string; tags: string[] }) => updateReceiptTags(id, tags),
    onSuccess: async () => {
      await invalidateReceipts(queryClient, clientId);
      await queryClient.invalidateQueries({ queryKey: ["receipt-tags"] });
    },
  });
}
