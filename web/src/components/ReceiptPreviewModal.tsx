"use client";

import { useEffect } from "react";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useReceiptFile } from "@/hooks/useReceipts";
import { formatDate, formatMoney } from "@/lib/format";
import { formatFileSize, receiptKindLabel, type ReceiptRecord } from "@/lib/receipts";
import { LoadingSpinner } from "./LoadingSpinner";

export function ReceiptPreviewModal({
  receipt,
  onClose,
}: {
  receipt: ReceiptRecord | null;
  onClose: () => void;
}) {
  const file = useReceiptFile(receipt?.id, Boolean(receipt));
  const url = useObjectUrl(file.data?.blob ?? null);
  const isPdf = receipt?.fileType === "pdf" || file.data?.contentType.includes("pdf");

  useEffect(() => {
    if (!receipt) {
      return;
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, receipt]);

  if (!receipt) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Receipt preview">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close preview" onClick={onClose} />
      <div className="relative flex max-h-[96vh] w-full max-w-4xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{receiptKindLabel(receipt.fileType)}</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{receipt.ocrMerchant || receipt.fileName}</h2>
            <p className="mt-1 text-sm text-ink-muted">
              {receipt.ocrAmount != null ? formatMoney(receipt.ocrAmount) : formatFileSize(receipt.fileSize)}
              {" · "}
              {formatDate(receipt.ocrDate || receipt.uploadedAt)}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40"
          >
            Close
          </button>
        </header>
        <div className="min-h-[20rem] flex-1 overflow-auto bg-paper p-4">
          {file.isLoading ? (
            <LoadingSpinner label="Loading receipt…" />
          ) : file.isError ? (
            <p className="text-sm text-danger">Unable to load this file.</p>
          ) : url && isPdf ? (
            <iframe title={receipt.fileName} src={url} className="h-[70vh] w-full rounded-xl bg-white" />
          ) : url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt={receipt.fileName} className="mx-auto max-h-[70vh] rounded-xl object-contain" />
          ) : (
            <p className="text-sm text-ink-muted">No preview available.</p>
          )}
        </div>
      </div>
    </div>
  );
}
