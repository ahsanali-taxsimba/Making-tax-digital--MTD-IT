"use client";

import Link from "next/link";
import {
  documentFrom,
  journalFrom,
  transactionFrom,
  vatFrom,
  type TimelineNode,
} from "@/lib/digital-links";
import type { DigitalLinks } from "@/lib/audit";
import { useDigitalLinkDocument, useDigitalLinkJournal, useDigitalLinkTransaction, useDigitalLinkVatReturn } from "@/hooks/useDigitalLinks";
import { DocumentPreview } from "./DocumentPreview";
import { JournalPreview } from "./JournalPreview";
import { TransactionPreview } from "./TransactionPreview";
import { VatReturnPreview } from "./VatReturnPreview";

export function DigitalLinkDetailPanel({
  node,
  links,
}: {
  node: TimelineNode;
  links: DigitalLinks;
}) {
  const documentQuery = useDigitalLinkDocument(node.kind === "document" ? node.id : null);
  const bankQuery = useDigitalLinkTransaction(node.kind === "bank" ? node.id : null);
  const journalQuery = useDigitalLinkJournal(node.kind === "journal" ? node.id : null);
  const vatQuery = useDigitalLinkVatReturn(node.kind === "vat" ? node.id : null);

  const document =
    node.kind === "document"
      ? documentFrom(links.document, { ...documentQuery.data, ...((links.extraction.detail ?? {}) as Record<string, unknown>) })
      : null;
  const transaction = node.kind === "bank" ? transactionFrom(links.bankTransaction, bankQuery.data) : null;
  const journal = node.kind === "journal" ? journalFrom(links.journalEntry, journalQuery.data) : null;
  const vatReturn = node.kind === "vat" ? vatFrom(links.vatReturn, vatQuery.data) : null;

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-muted">{node.title}</p>
          <h3 className="mt-1 text-lg font-semibold text-ink">{node.subtitle}</h3>
        </div>
        <Link href={node.href} className="rounded-xl bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark">
          {node.openLabel}
        </Link>
      </div>
      <div className="mt-5">
        {node.status === "missing" ? (
          <p className="text-sm text-ink-muted">This step is not linked yet. Attach a document or match the bank line to complete the HMRC digital link.</p>
        ) : null}
        {document ? <DocumentPreview document={document} /> : null}
        {transaction ? <TransactionPreview transaction={transaction} /> : null}
        {journal ? <JournalPreview journal={journal} /> : null}
        {vatReturn ? <VatReturnPreview vatReturn={vatReturn} /> : null}
      </div>
    </section>
  );
}
