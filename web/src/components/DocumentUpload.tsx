"use client";

import { FormEvent, useState } from "react";
import { useUploadDocument } from "@/hooks/useDocuments";
import { ErrorBanner } from "./ErrorBanner";
import { SuccessBanner } from "./SuccessBanner";

const CATEGORIES = [
  { value: "bank_statement", label: "Bank statement" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
];

export function DocumentUpload({ clientId }: { clientId?: string | null }) {
  const upload = useUploadDocument(clientId);
  const [category, setCategory] = useState("bank_statement");
  const [fileName, setFileName] = useState<string | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem("file") as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    setFileName(file.name);
    Object.assign(file, { category });
    upload.mutate(file as File & { category?: string });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-dashed border-line bg-white p-6">
      <div>
        <h2 className="text-lg font-semibold">Upload records</h2>
        <p className="mt-1 text-sm text-ink-muted">Bank statements, invoices, and receipts stay with your accountant. Files are stored as metadata only in this demo.</p>
      </div>
      {upload.isError ? <ErrorBanner title="Upload failed" message="We could not store that document. Try again." /> : null}
      {upload.isSuccess ? <SuccessBanner title="Uploaded" message={`${fileName ?? "Your file"} is waiting for your accountant.`} /> : null}
      <label className="block text-sm">
        <span className="font-medium">Type</span>
        <select
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {CATEGORIES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className="font-medium">File</span>
        <input className="mt-1 w-full rounded-lg border border-line px-3 py-2" name="file" type="file" required />
      </label>
      <button
        type="submit"
        disabled={upload.isPending}
        className="rounded-xl bg-teal px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
      >
        {upload.isPending ? "Uploading…" : "Upload document"}
      </button>
    </form>
  );
}
