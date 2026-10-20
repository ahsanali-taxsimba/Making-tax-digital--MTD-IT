"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { detachLibraryDocument, listLibraryDocuments, uploadSupportingDocument } from "@/lib/invoice-extraction";

export function useAttachments(options: {
  clientId?: string | null;
  documentId?: string | null;
  invoiceId?: string | null;
  billId?: string | null;
}) {
  const tag = options.documentId ? `extraction:${options.documentId}` : undefined;
  const query = useQuery({
    queryKey: ["invoice-attachments", options.clientId, options.documentId, options.invoiceId, options.billId],
    queryFn: async () => {
      const [tagged, invoiced, billed] = await Promise.all([
        options.clientId && tag ? listLibraryDocuments({ clientId: options.clientId, tag }) : Promise.resolve({ documents: [], count: 0 }),
        options.invoiceId ? listLibraryDocuments({ invoiceId: options.invoiceId }) : Promise.resolve({ documents: [], count: 0 }),
        options.billId ? listLibraryDocuments({ billId: options.billId }) : Promise.resolve({ documents: [], count: 0 }),
      ]);
      const seen = new Set<string>();
      const documents = [...tagged.documents, ...invoiced.documents, ...billed.documents].filter((item) => {
        if (item.id === options.documentId || seen.has(item.id)) {
          return false;
        }
        seen.add(item.id);
        return true;
      });
      return { documents, count: documents.length };
    },
    enabled: Boolean(options.clientId || options.invoiceId || options.billId),
  });

  return query;
}

export function useUploadAttachment(options: {
  clientId?: string | null;
  documentId?: string | null;
  invoiceId?: string | null;
  billId?: string | null;
}) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      if (!options.clientId) {
        throw new Error("Select a client before attaching a document");
      }
      return uploadSupportingDocument({
        clientId: options.clientId,
        file,
        type: /contract|agreement/i.test(file.name) ? "contract" : "receipt",
        tags: options.documentId ? [`extraction:${options.documentId}`] : undefined,
        invoiceId: options.invoiceId ?? undefined,
        billId: options.billId ?? undefined,
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoice-attachments"] });
    },
  });
}

export function useRemoveAttachment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => detachLibraryDocument(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["invoice-attachments"] });
    },
  });
}
