"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AttachReceiptModal } from "@/components/AttachReceiptModal";
import { BankWorkspaceNav } from "@/components/BankWorkspaceNav";
import { ErrorBanner } from "@/components/ErrorBanner";
import { ReceiptsSubNav } from "@/components/ReceiptsSubNav";
import { SuccessBanner } from "@/components/SuccessBanner";
import { TagSelector } from "@/components/TagSelector";
import { UploadDropzone } from "@/components/UploadDropzone";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import { useAttachReceipt, useReceiptDocuments, useReceiptSuggestions, useReceiptTags, useUploadReceipt } from "@/hooks/useReceipts";
import { useClientBankLines } from "@/hooks/useClientBankLines";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatMoney } from "@/lib/format";
import {
  bankLineToTarget,
  billToTarget,
  formatFileSize,
  invoiceToTarget,
  journalToTarget,
  readFileAsBase64,
  receiptKindLabel,
  dedupeAttachTargets,
  suggestAttachTargets,
  suggestionToTarget,
  type ReceiptRecord,
} from "@/lib/receipts";
import { isPracticeStaff } from "@/lib/session";

interface PendingFile {
  id: string;
  file: File;
}

export function ReceiptUploadWorkspace({ basePath, staffNav = false }: { basePath: string; staffNav?: boolean }) {
  const { clientId, user } = useSession();
  const upload = useUploadReceipt(clientId);
  const attach = useAttachReceipt(clientId);
  const tags = useReceiptTags();
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploaded, setUploaded] = useState<ReceiptRecord[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attachFor, setAttachFor] = useState<ReceiptRecord | null>(null);
  const last = uploaded[uploaded.length - 1] ?? null;
  const suggestions = useReceiptSuggestions(last?.id);
  const lines = useClientBankLines(last ? clientId : null);
  const documents = useReceiptDocuments(last ? clientId : null);

  const autoSuggest = useMemo(() => {
    if (!last) {
      return [];
    }
    const fromApi = (suggestions.data?.suggestions ?? []).map(suggestionToTarget);
    const extras = suggestAttachTargets(last, [
      ...(lines.data ?? []).map(bankLineToTarget),
      ...(documents.invoices.data ?? []).map(invoiceToTarget),
      ...(documents.bills.data ?? []).map(billToTarget),
      ...(documents.journals.data ?? []).map(journalToTarget),
    ]);
    return dedupeAttachTargets([...fromApi, ...extras]);
  }, [documents.bills.data, documents.invoices.data, documents.journals.data, last, lines.data, suggestions.data]);

  function addFiles(files: File[]) {
    setPending((current) => [
      ...current,
      ...files.map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
      })),
    ]);
  }

  async function onUpload() {
    if (!clientId || !pending.length) {
      return;
    }
    setError(null);
    try {
      const results: ReceiptRecord[] = [];
      for (const item of pending) {
        const saved = await upload.mutateAsync({
          clientId,
          fileName: item.file.name,
          content: await readFileAsBase64(item.file),
          mimeType: item.file.type,
          tags: selectedTags,
        });
        results.push(saved);
      }
      setUploaded((current) => [...current, ...results]);
      setPending([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload receipt");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Receipts</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Upload</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Preview files before they are stored, then attach them to a bank transaction, invoice, bill, or journal.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {staffNav && isPracticeStaff(user?.role, user) ? <BankWorkspaceNav /> : null}
          <ReceiptsSubNav basePath={basePath} />
        </div>
      </div>
      {!clientId ? <ErrorBanner title="Select a client" message="Choose a client before uploading receipts." /> : null}
      {error ? <ErrorBanner title="Upload failed" message={error} /> : null}
      {uploaded.length ? (
        <SuccessBanner title="Stored" message={`${uploaded.length} receipt${uploaded.length === 1 ? "" : "s"} uploaded. Review suggested attachments below.`} />
      ) : null}
      <UploadDropzone disabled={!clientId || upload.isPending} onFiles={addFiles} />
      {pending.length ? (
        <section className="space-y-4 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <h3 className="text-lg font-semibold text-ink">Preview before upload</h3>
          <ul className="grid gap-4 md:grid-cols-2">
            {pending.map((item) => (
              <PendingPreview
                key={item.id}
                file={item.file}
                onRemove={() => setPending((current) => current.filter((row) => row.id !== item.id))}
              />
            ))}
          </ul>
          <div>
            <h4 className="text-sm font-semibold text-ink">Tags</h4>
            <div className="mt-2">
              <TagSelector value={selectedTags} catalog={tags.data?.tags ?? []} onChange={setSelectedTags} />
            </div>
          </div>
          <button
            type="button"
            disabled={!clientId || upload.isPending}
            onClick={() => void onUpload()}
            className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
          >
            {upload.isPending ? "Uploading…" : `Upload ${pending.length} file${pending.length === 1 ? "" : "s"}`}
          </button>
        </section>
      ) : null}
      {last ? (
        <section className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-ink">Suggested attachment</h3>
              <p className="text-sm text-ink-muted">
                {last.ocrMerchant || last.fileName}
                {last.ocrAmount != null ? ` · ${formatMoney(last.ocrAmount)}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`${basePath}/${last.id}`} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40">
                Open receipt
              </Link>
              <button
                type="button"
                onClick={() => setAttachFor(last)}
                className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-dark"
              >
                Search records
              </button>
            </div>
          </div>
          {autoSuggest.length ? (
            <ul className="space-y-2">
              {autoSuggest.map((target) => (
                <li key={`${target.kind}-${target.id}`} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper px-4 py-3">
                  <div>
                    <p className="font-semibold text-ink">{target.title}</p>
                    <p className="text-sm text-ink-muted">
                      {target.kind}
                      {target.date ? ` · ${formatDate(target.date)}` : ""}
                      {target.amount != null ? ` · ${formatMoney(target.amount)}` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={attach.isPending}
                    onClick={() => void attach.mutateAsync({ receiptId: last.id, target })}
                    className="rounded-lg border border-line bg-white px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40 disabled:opacity-60"
                  >
                    Attach
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-ink-muted">No confident match yet. Search bank lines, invoices, or bills.</p>
          )}
        </section>
      ) : null}
      <AttachReceiptModal receipt={attachFor} clientId={clientId} open={Boolean(attachFor)} onClose={() => setAttachFor(null)} />
    </div>
  );
}

function PendingPreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const url = useObjectUrl(file.type.startsWith("image/") ? file : null);
  return (
    <li className="overflow-hidden rounded-xl border border-line">
      <div className="flex h-40 items-center justify-center bg-paper">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={file.name} className="h-full w-full object-cover" />
        ) : (
          <span className="text-sm font-semibold uppercase tracking-wide text-teal">{receiptKindLabel(file.name.split(".").pop() ?? "pdf")}</span>
        )}
      </div>
      <div className="flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{file.name}</p>
          <p className="text-xs text-ink-muted">{formatFileSize(file.size)}</p>
        </div>
        <button type="button" onClick={onRemove} className="text-xs font-semibold text-danger">
          Remove
        </button>
      </div>
    </li>
  );
}
