"use client";

import { useMemo, useState } from "react";
import { useClientBankLines } from "@/hooks/useClientBankLines";
import { useAttachReceipt, useReceiptDocuments, useReceiptSuggestions } from "@/hooks/useReceipts";
import { formatDate, formatMoney } from "@/lib/format";
import {
  bankLineToTarget,
  billToTarget,
  invoiceToTarget,
  journalToTarget,
  receiptAttachmentLabel,
  searchAttachTargets,
  suggestAttachTargets,
  suggestionToTarget,
  dedupeAttachTargets,
  type AttachTarget,
  type ReceiptAttachmentKind,
  type ReceiptRecord,
} from "@/lib/receipts";
import { ErrorBanner } from "./ErrorBanner";
import { LoadingSpinner } from "./LoadingSpinner";

const TABS: Array<Exclude<ReceiptAttachmentKind, "unattached">> = ["bank", "invoice", "bill", "journal"];

export function AttachReceiptModal({
  receipt,
  clientId,
  open,
  onClose,
}: {
  receipt: ReceiptRecord | null;
  clientId?: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<(typeof TABS)[number]>("bank");
  const [query, setQuery] = useState("");
  const lines = useClientBankLines(open ? clientId : null);
  const documents = useReceiptDocuments(open ? clientId : null);
  const suggestions = useReceiptSuggestions(open ? receipt?.id : null);
  const attach = useAttachReceipt(clientId);

  const targets = useMemo(() => {
    const bank = (lines.data ?? []).map(bankLineToTarget);
    const invoices = (documents.invoices.data ?? []).map(invoiceToTarget);
    const bills = (documents.bills.data ?? []).map(billToTarget);
    const journals = (documents.journals.data ?? []).map(journalToTarget);
    const byKind = { bank, invoice: invoices, bill: bills, journal: journals };
    return searchAttachTargets(byKind[tab], query);
  }, [documents.bills.data, documents.invoices.data, documents.journals.data, lines.data, query, tab]);

  const suggested = useMemo(() => {
    if (!receipt) {
      return [];
    }
    const fromApi = (suggestions.data?.suggestions ?? []).map(suggestionToTarget);
    const extras = suggestAttachTargets(receipt, [
      ...(lines.data ?? []).map(bankLineToTarget),
      ...(documents.invoices.data ?? []).map(invoiceToTarget),
      ...(documents.bills.data ?? []).map(billToTarget),
      ...(documents.journals.data ?? []).map(journalToTarget),
    ]);
    return dedupeAttachTargets([...fromApi, ...extras]);
  }, [documents.bills.data, documents.invoices.data, documents.journals.data, lines.data, receipt, suggestions.data]);

  if (!open || !receipt) {
    return null;
  }

  const loading = lines.isLoading || documents.invoices.isLoading || documents.bills.isLoading || documents.journals.isLoading;

  async function onAttach(target: AttachTarget) {
    await attach.mutateAsync({ receiptId: receipt.id, target });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label="Attach receipt">
      <button type="button" className="absolute inset-0 cursor-default" aria-label="Close attach dialog" onClick={onClose} />
      <div className="relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Attach receipt</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">{receipt.ocrMerchant || receipt.fileName}</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-line px-3 py-1.5 text-sm font-semibold text-ink hover:border-teal/40">
            Close
          </button>
        </header>
        <div className="space-y-4 overflow-auto p-5">
          {attach.isError ? <ErrorBanner title="Could not attach" message={attach.error.message} /> : null}
          {suggested.length ? (
            <section>
              <h3 className="text-sm font-semibold text-ink">Suggested matches</h3>
              <ul className="mt-2 space-y-2">
                {suggested.map((target) => (
                  <AttachRow key={`s-${target.kind}-${target.id}`} target={target} pending={attach.isPending} onAttach={() => void onAttach(target)} />
                ))}
              </ul>
            </section>
          ) : null}
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Attach to">
            {TABS.map((item) => (
              <button
                key={item}
                type="button"
                role="tab"
                aria-selected={tab === item}
                onClick={() => setTab(item)}
                className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${
                  tab === item ? "bg-teal text-white" : "border border-line bg-white text-ink hover:border-teal/40"
                }`}
              >
                {receiptAttachmentLabel(item)}
              </button>
            ))}
          </div>
          <input
            className="w-full rounded-lg border border-line px-3 py-2 text-sm"
            placeholder={`Search ${receiptAttachmentLabel(tab).toLowerCase()}s`}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          {loading ? (
            <LoadingSpinner label="Loading bookkeeping records…" />
          ) : (
            <ul className="space-y-2">
              {targets.length ? (
                targets.map((target) => (
                  <AttachRow key={`${target.kind}-${target.id}`} target={target} pending={attach.isPending} onAttach={() => void onAttach(target)} />
                ))
              ) : (
                <li className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-muted">No matching records.</li>
              )}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function AttachRow({
  target,
  pending,
  onAttach,
}: {
  target: AttachTarget;
  pending: boolean;
  onAttach: () => void;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-paper/60 px-4 py-3">
      <div className="min-w-0">
        <p className="font-semibold text-ink">{target.title}</p>
        <p className="text-sm text-ink-muted">
          {receiptAttachmentLabel(target.kind)}
          {target.date ? ` · ${formatDate(target.date)}` : ""}
          {target.amount != null ? ` · ${formatMoney(target.amount)}` : ""}
        </p>
        {target.subtitle ? <p className="truncate text-xs text-ink-muted">{target.subtitle}</p> : null}
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={onAttach}
        className="rounded-lg bg-teal px-3 py-1.5 text-sm font-semibold text-white hover:bg-teal-dark disabled:opacity-60"
      >
        Attach
      </button>
    </li>
  );
}
