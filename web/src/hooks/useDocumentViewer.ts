"use client";

import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { fetchDocumentFile } from "@/lib/invoice-extraction";

export function useDocumentFile(documentId?: string | null, enabled = true) {
  return useQuery({
    queryKey: ["document-file", documentId],
    queryFn: () => fetchDocumentFile(documentId!),
    enabled: Boolean(documentId) && enabled,
    staleTime: 5 * 60_000,
  });
}

export function useDocumentViewer() {
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(1);

  const zoomIn = useCallback(() => setScale((value) => Math.min(3, Number((value + 0.25).toFixed(2)))), []);
  const zoomOut = useCallback(() => setScale((value) => Math.max(0.5, Number((value - 0.25).toFixed(2)))), []);
  const rotate = useCallback(() => setRotation((value) => (value + 90) % 360), []);
  const reset = useCallback(() => {
    setScale(1);
    setRotation(0);
    setPage(1);
  }, []);
  const nextPage = useCallback(() => setPage((value) => Math.min(pageCount, value + 1)), [pageCount]);
  const previousPage = useCallback(() => setPage((value) => Math.max(1, value - 1)), []);

  return useMemo(
    () => ({
      scale,
      rotation,
      page,
      pageCount,
      setPage,
      setPageCount,
      zoomIn,
      zoomOut,
      rotate,
      reset,
      nextPage,
      previousPage,
    }),
    [nextPage, page, pageCount, previousPage, reset, rotate, rotation, scale, zoomIn, zoomOut],
  );
}
