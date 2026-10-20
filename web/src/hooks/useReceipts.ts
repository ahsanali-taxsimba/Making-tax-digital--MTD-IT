"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  detachReceipt,
  listBankTransactionReceipts,
  listBillReceipts,
  listInvoiceReceipts,
  listReceipts,
  receiptEvidence,
  uploadReceipt,
} from "@/lib/receipts";

export function useClientReceipts(clientId?: string | null) {
  return useQuery({
    queryKey: ["receipts", clientId],
    queryFn: () => listReceipts(clientId!),
    enabled: Boolean(clientId),
  });
}

export function useTargetReceipts(target: { kind: "bank" | "invoice" | "bill"; id?: string | null }) {
  return useQuery({
    queryKey: ["receipts-target", target.kind, target.id],
    queryFn: () => {
      if (target.kind === "invoice") {
        return listInvoiceReceipts(target.id!);
      }
      if (target.kind === "bill") {
        return listBillReceipts(target.id!);
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

export function useUploadReceipt(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: uploadReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["receipts", clientId] });
      await queryClient.invalidateQueries({ queryKey: ["receipts-target"] });
      await queryClient.invalidateQueries({ queryKey: ["receipt-evidence", clientId] });
    },
  });
}

export function useDetachReceipt(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: detachReceipt,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["receipts", clientId] });
      await queryClient.invalidateQueries({ queryKey: ["receipts-target"] });
    },
  });
}
