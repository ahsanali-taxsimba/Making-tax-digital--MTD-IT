"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  confirmExtraction,
  extractFromDocument,
  getBookkeepingInvoice,
  getInvoiceExtraction,
  getJournalPreview,
  listExtractionAudit,
  listExtractions,
  listInvoiceAudit,
  postBookkeepingInvoice,
  rejectExtraction,
  reprocessExtraction,
  saveExtractionDraft,
  type ExtractionForm,
  type InvoiceDirection,
} from "@/lib/invoice-extraction";

function invalidateExtraction(queryClient: ReturnType<typeof useQueryClient>, documentId?: string, clientId?: string | null) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["invoice-extraction", documentId] }),
    queryClient.invalidateQueries({ queryKey: ["invoice-extractions", clientId] }),
    queryClient.invalidateQueries({ queryKey: ["invoice-extraction-audit", documentId] }),
    queryClient.invalidateQueries({ queryKey: ["invoice-attachments"] }),
    queryClient.invalidateQueries({ queryKey: ["bookkeeping-invoice"] }),
  ]);
}

export function useInvoiceExtractions(clientId?: string | null) {
  return useQuery({
    queryKey: ["invoice-extractions", clientId],
    queryFn: () => listExtractions(clientId!),
    enabled: Boolean(clientId),
  });
}

export function useInvoiceExtraction(documentId?: string | null) {
  return useQuery({
    queryKey: ["invoice-extraction", documentId],
    queryFn: () => getInvoiceExtraction(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useExtractionAudit(documentId?: string | null) {
  return useQuery({
    queryKey: ["invoice-extraction-audit", documentId],
    queryFn: () => listExtractionAudit(documentId!),
    enabled: Boolean(documentId),
  });
}

export function useExtractInvoice(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ documentId, direction }: { documentId: string; direction?: InvoiceDirection }) =>
      extractFromDocument(documentId, direction),
    onSuccess: async (_data, variables) => {
      await invalidateExtraction(queryClient, variables.documentId, clientId);
    },
  });
}

export function useSaveExtractionDraft(documentId: string, clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: ExtractionForm) => saveExtractionDraft(documentId, form),
    onSuccess: async () => {
      await invalidateExtraction(queryClient, documentId, clientId);
    },
  });
}

export function useConfirmExtraction(documentId: string, clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (form: ExtractionForm) => confirmExtraction(documentId, form),
    onSuccess: async () => {
      await invalidateExtraction(queryClient, documentId, clientId);
    },
  });
}

export function useRejectExtraction(documentId: string, clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (reason?: string) => rejectExtraction(documentId, reason),
    onSuccess: async () => {
      await invalidateExtraction(queryClient, documentId, clientId);
    },
  });
}

export function useReprocessExtraction(documentId: string, clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (direction?: InvoiceDirection) => reprocessExtraction(documentId, direction),
    onSuccess: async () => {
      await invalidateExtraction(queryClient, documentId, clientId);
    },
  });
}

export function useBookkeepingInvoice(id?: string | null, kind: InvoiceDirection = "sales") {
  return useQuery({
    queryKey: ["bookkeeping-invoice", kind, id],
    queryFn: () => getBookkeepingInvoice(id!, kind),
    enabled: Boolean(id),
  });
}

export function useJournalPreview(id?: string | null, kind: InvoiceDirection = "sales", enabled = false) {
  return useQuery({
    queryKey: ["journal-preview", kind, id],
    queryFn: () => getJournalPreview(id!, kind),
    enabled: Boolean(id) && enabled,
  });
}

export function usePostBookkeepingInvoice(id: string, kind: InvoiceDirection) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => postBookkeepingInvoice(id, kind),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["bookkeeping-invoice", kind, id] });
      await queryClient.invalidateQueries({ queryKey: ["journal-preview", kind, id] });
      await queryClient.invalidateQueries({ queryKey: ["invoice-audit", kind, id] });
    },
  });
}

export function useInvoiceAudit(id?: string | null, kind: InvoiceDirection = "sales", clientId?: string | null) {
  return useQuery({
    queryKey: ["invoice-audit", kind, id, clientId],
    queryFn: () => listInvoiceAudit(id!, kind, clientId!),
    enabled: Boolean(id && clientId),
  });
}
