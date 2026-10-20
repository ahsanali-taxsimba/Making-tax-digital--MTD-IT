"use client";

import { useRef } from "react";
import { RECEIPT_ACCEPT } from "@/lib/receipts";
import type { LibraryDocument } from "@/lib/invoice-extraction";
import { formatFileSize } from "@/lib/receipts";

export function AttachmentPanel({
  documents,
  uploading,
  onUpload,
  onRemove,
  title = "Supporting documents",
  actionLabel = "Attach Additional Document",
}: {
  documents: LibraryDocument[];
  uploading?: boolean;
  onUpload: (file: File) => void;
  onRemove?: (id: string) => void;
  title?: string;
  actionLabel?: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <button
          type="button"
          disabled={uploading}
          onClick={() => input.current?.click()}
          className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink"
        >
          {uploading ? "Uploading…" : actionLabel}
        </button>
        <input
          ref={input}
          type="file"
          accept={RECEIPT_ACCEPT}
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) {
              onUpload(file);
            }
            event.target.value = "";
          }}
        />
      </div>
      {!documents.length ? (
        <p className="mt-3 text-sm text-ink-muted">No additional receipts or contracts attached.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {documents.map((document) => (
            <li key={document.id} className="flex items-center gap-3 rounded-xl border border-line p-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-paper text-xs font-bold uppercase text-teal">
                {document.fileType === "pdf" ? "PDF" : document.fileType}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{document.fileName}</p>
                <p className="text-xs text-ink-muted">{formatFileSize(document.fileSize)}</p>
              </div>
              {onRemove ? (
                <button type="button" className="text-xs font-semibold text-danger" onClick={() => onRemove(document.id)}>
                  Remove
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
