"use client";

import { useRef, useState } from "react";
import { useTargetReceipts, useUploadReceipt } from "@/hooks/useReceipts";
import { readFileAsBase64 } from "@/lib/receipts";
import { ReceiptThumbnails } from "./ReceiptThumbnails";

export function AttachReceiptButton({
  clientId,
  bankTransactionId,
  invoiceId,
  billId,
  journalEntryId,
}: {
  clientId?: string | null;
  bankTransactionId?: string;
  invoiceId?: string;
  billId?: string;
  journalEntryId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const upload = useUploadReceipt(clientId);
  const kind = invoiceId ? "invoice" : billId ? "bill" : "bank";
  const targetId = invoiceId ?? billId ?? bankTransactionId;
  const existing = useTargetReceipts({ kind, id: targetId });

  async function onPick(file: File | undefined) {
    if (!file || !clientId) {
      return;
    }
    setError(null);
    try {
      const content = await readFileAsBase64(file);
      await upload.mutateAsync({
        clientId,
        fileName: file.name,
        content,
        mimeType: file.type,
        bankTransactionId,
        invoiceId,
        billId,
        journalEntryId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload receipt");
    } finally {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
        className="sr-only"
        aria-label="Upload receipt"
        onChange={(event) => void onPick(event.target.files?.[0])}
      />
      <button
        type="button"
        disabled={!clientId || upload.isPending}
        onClick={() => inputRef.current?.click()}
        className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40 disabled:opacity-60"
      >
        {upload.isPending ? "Uploading…" : "Attach receipt"}
      </button>
      {existing.data?.receipts.length ? <ReceiptThumbnails receipts={existing.data.receipts} /> : null}
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
