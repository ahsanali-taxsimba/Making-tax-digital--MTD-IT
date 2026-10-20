"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AttachReceiptModal } from "@/components/AttachReceiptModal";
import { BankWorkspaceNav } from "@/components/BankWorkspaceNav";
import { ErrorBanner } from "@/components/ErrorBanner";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { OCRTextPanel } from "@/components/OCRTextPanel";
import { ReceiptsSubNav } from "@/components/ReceiptsSubNav";
import { SuccessBanner } from "@/components/SuccessBanner";
import { TagSelector } from "@/components/TagSelector";
import { useObjectUrl } from "@/hooks/useObjectUrl";
import {
  useDetachReceipt,
  useReceipt,
  useReceiptActivity,
  useReceiptFile,
  useReceiptTags,
  useReprocessReceiptOcr,
  useUpdateReceiptTags,
} from "@/hooks/useReceipts";
import { useSession } from "@/hooks/useSession";
import { formatDate, formatMoney } from "@/lib/format";
import {
  deriveReceiptActivity,
  formatFileSize,
  receiptAttachmentKind,
  receiptAttachmentLabel,
  receiptKindLabel,
} from "@/lib/receipts";
import { isPracticeStaff } from "@/lib/session";

export function ReceiptDetailWorkspace({
  receiptId,
  basePath,
  staffNav = false,
}: {
  receiptId: string;
  basePath: string;
  staffNav?: boolean;
}) {
  const { clientId, user } = useSession();
  const receipt = useReceipt(receiptId);
  const file = useReceiptFile(receiptId);
  const url = useObjectUrl(file.data?.blob ?? null);
  const tags = useReceiptTags();
  const activity = useReceiptActivity(clientId, receiptId);
  const saveTags = useUpdateReceiptTags(clientId);
  const detach = useDetachReceipt(clientId);
  const reprocess = useReprocessReceiptOcr(clientId);
  const [tagDraft, setTagDraft] = useState<string[]>([]);
  const [attachOpen, setAttachOpen] = useState(false);

  useEffect(() => {
    if (receipt.data) {
      setTagDraft(receipt.data.tags);
    }
  }, [receipt.data]);

  const row = receipt.data;
  const isPdf = row?.fileType === "pdf" || file.data?.contentType.includes("pdf");
  const events = row ? deriveReceiptActivity(row, activity.data ?? []) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href={basePath} className="text-sm font-semibold text-teal underline-offset-2 hover:underline">
            ← All receipts
          </Link>
          <h2 className="mt-2 text-2xl font-semibold text-ink">{row?.ocrMerchant || row?.fileName || "Receipt"}</h2>
        </div>
        <div className="flex flex-col items-end gap-3">
          {staffNav && isPracticeStaff(user?.role) ? <BankWorkspaceNav /> : null}
          <ReceiptsSubNav basePath={basePath} />
        </div>
      </div>
      {receipt.isError ? <ErrorBanner title="Receipt unavailable" message={receipt.error.message} /> : null}
      {receipt.isLoading || !row ? (
        receipt.isError ? null : <LoadingSpinner label="Opening receipt…" />
      ) : (
        <>
          {saveTags.isSuccess ? <SuccessBanner title="Tags saved" message="The receipt tag list was updated." /> : null}
          {detach.isSuccess ? <SuccessBanner title="Detached" message="This receipt is no longer linked to a bookkeeping record." /> : null}
          {saveTags.isError ? <ErrorBanner title="Could not save tags" message={saveTags.error.message} /> : null}
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.8fr)]">
            <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">{receiptKindLabel(row.fileType)}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {formatFileSize(row.fileSize)} · uploaded {formatDate(row.uploadedAt)}
                  </p>
                </div>
                {url ? (
                  <a
                    href={url}
                    download={row.fileName}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40"
                  >
                    Download
                  </a>
                ) : null}
              </div>
              <div className="bg-paper p-4">
                {file.isLoading ? (
                  <LoadingSpinner label="Loading file…" />
                ) : file.isError ? (
                  <p className="text-sm text-danger">Unable to load this file.</p>
                ) : url && isPdf ? (
                  <iframe title={row.fileName} src={url} className="h-[70vh] w-full rounded-xl bg-white" />
                ) : url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={url} alt={row.fileName} className="mx-auto max-h-[70vh] rounded-xl object-contain" />
                ) : (
                  <p className="text-sm text-ink-muted">No preview available.</p>
                )}
              </div>
            </section>
            <div className="space-y-6">
              <section className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-ink">Attachment</h3>
                <p className="text-sm text-ink-muted">
                  {row.proofAvailable
                    ? `Linked to a ${receiptAttachmentLabel(receiptAttachmentKind(row)).toLowerCase()}.`
                    : "Not attached to a bank line, invoice, bill, or journal yet."}
                </p>
                <dl className="grid gap-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Amount</dt>
                    <dd className="font-semibold">{formatMoney(row.ocrAmount)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-ink-muted">Date</dt>
                    <dd className="font-semibold">{formatDate(row.ocrDate)}</dd>
                  </div>
                </dl>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setAttachOpen(true)}
                    className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-dark"
                  >
                    Attach
                  </button>
                  <button
                    type="button"
                    disabled={!row.proofAvailable || detach.isPending}
                    onClick={() => void detach.mutateAsync(row.id)}
                    className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-danger/40 hover:text-danger disabled:opacity-60"
                  >
                    {detach.isPending ? "Detaching…" : "Detach"}
                  </button>
                </div>
              </section>
              <section className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-ink">Tags</h3>
                <TagSelector
                  value={tagDraft}
                  catalog={tags.data?.tags ?? []}
                  pending={saveTags.isPending}
                  onChange={setTagDraft}
                  onSave={(next) => saveTags.mutate({ id: row.id, tags: next })}
                />
              </section>
              <section className="space-y-3 rounded-2xl border border-line bg-white p-5 shadow-sm">
                <h3 className="text-lg font-semibold text-ink">Activity</h3>
                <ol className="space-y-3">
                  {events.map((item) => (
                    <li key={item.id} className="border-l-2 border-line pl-3">
                      <p className="text-sm font-semibold text-ink">{item.label}</p>
                      <p className="text-xs text-ink-muted">
                        {formatDate(item.at)}
                        {item.detail ? ` · ${item.detail}` : ""}
                      </p>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>
          <OCRTextPanel
            receipt={row}
            pending={reprocess.isPending}
            onReprocess={() => void reprocess.mutateAsync(row.id)}
          />
          <AttachReceiptModal receipt={row} clientId={clientId} open={attachOpen} onClose={() => setAttachOpen(false)} />
        </>
      )}
    </div>
  );
}
