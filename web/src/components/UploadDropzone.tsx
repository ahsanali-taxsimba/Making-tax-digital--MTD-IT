"use client";

import { useRef, useState } from "react";
import { RECEIPT_ACCEPT, formatFileSize, receiptFileError } from "@/lib/receipts";

export function UploadDropzone({
  disabled,
  multiple = true,
  onFiles,
}: {
  disabled?: boolean;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function take(list: FileList | File[] | null) {
    const incoming = list ? Array.from(list) : [];
    if (!incoming.length) {
      return;
    }
    const rejected = incoming.map(receiptFileError).find(Boolean) ?? null;
    if (rejected) {
      setError(rejected);
      return;
    }
    setError(null);
    onFiles(incoming);
  }

  return (
    <div className="space-y-2">
      <input
        ref={inputRef}
        type="file"
        accept={RECEIPT_ACCEPT}
        multiple={multiple}
        className="sr-only"
        aria-label="Choose receipt files"
        disabled={disabled}
        onChange={(event) => {
          take(event.target.files);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
        className={`flex min-h-48 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition ${
          over ? "border-teal bg-teal/5" : "border-line bg-white hover:border-teal/40"
        } disabled:opacity-60`}
      >
        <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-teal">
          JPG · PNG · PDF
        </span>
        <p className="mt-3 text-lg font-semibold text-ink">Drop receipts here</p>
        <p className="mt-1 max-w-md text-sm text-ink-muted">
          Or tap to choose files. Images and PDFs up to 12MB stay with the client record for MTD evidence.
        </p>
        <p className="mt-4 text-xs text-ink-muted">Typical size {formatFileSize(240_000)}–{formatFileSize(2_000_000)}</p>
      </button>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
    </div>
  );
}
