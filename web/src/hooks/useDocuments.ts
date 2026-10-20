"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listDocuments, uploadDocument } from "@/lib/portal";

export function useDocuments(clientId?: string | null) {
  return useQuery({
    queryKey: ["documents", clientId],
    queryFn: () => listDocuments(clientId),
    enabled: Boolean(clientId),
  });
}

export function useUploadDocument(clientId?: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File & { category?: string }) =>
      uploadDocument({
        clientId: clientId ?? undefined,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size,
        category: file.category,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["documents", clientId] });
    },
  });
}
