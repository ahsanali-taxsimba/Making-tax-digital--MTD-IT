"use client";

import { useRef, useState } from "react";
import { BankWorkspaceNav } from "@/components/BankWorkspaceNav";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ReceiptThumbnails } from "@/components/ReceiptThumbnails";
import { RequireStaff } from "@/components/RequireStaff";
import { useClientReceipts, useUploadReceipt } from "@/hooks/useReceipts";
import { useSession } from "@/hooks/useSession";
import { formatDate } from "@/lib/format";
import { readFileAsBase64, receiptKindLabel } from "@/lib/receipts";

export default function ReceiptsWorkspacePage() {
  const { clientId } = useSession();
  const receipts = useClientReceipts(clientId);
  const upload = useUploadReceipt(clientId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function onPick(file: File | undefined) {
    if (!file || !clientId) {
      return;
    }
    setError(null);
    try {
      await upload.mutateAsync({
        clientId,
        fileName: file.name,
        content: await readFileAsBase64(file),
        mimeType: file.type,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload receipt");
    }
  }

  return (
    <RequireStaff>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-ink-muted">HMRC digital records</p>
            <h2 className="mt-1 text-2xl font-semibold text-ink">Receipts</h2>
          </div>
          <BankWorkspaceNav />
        </div>
        {!clientId ? (
          <ErrorBanner title="Select a client" message="Choose a client to upload and attach receipts." />
        ) : receipts.isError ? (
          <ErrorBanner title="Receipts unavailable" message={receipts.error.message} />
        ) : receipts.isLoading ? (
          <LoadingSpinner label="Loading receipts…" />
        ) : (
          <>
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
              disabled={upload.isPending}
              onClick={() => inputRef.current?.click()}
              className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
            >
              {upload.isPending ? "Uploading…" : "Upload JPG, PNG or PDF"}
            </button>
            {error ? <ErrorBanner title="Upload failed" message={error} /> : null}
            <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-ink">Stored receipts</h3>
              <ReceiptThumbnails receipts={receipts.data?.receipts ?? []} />
              <ul className="mt-4 divide-y divide-line">
                {(receipts.data?.receipts ?? []).map((receipt) => (
                  <li key={receipt.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                    <div>
                      <p className="font-medium text-ink">{receipt.fileName}</p>
                      <p className="text-ink-muted">
                        {receiptKindLabel(receipt.fileType)} · {formatDate(receipt.uploadedAt)}
                        {receipt.ocrMerchant ? ` · ${receipt.ocrMerchant}` : ""}
                        {receipt.proofAvailable ? " · attached" : ""}
                      </p>
                    </div>
                    <span className="rounded-full bg-paper px-2 py-0.5 text-xs capitalize text-ink-muted">{receipt.status}</span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </RequireStaff>
  );
}
