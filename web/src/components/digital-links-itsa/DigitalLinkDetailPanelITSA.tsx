"use client";

import Link from "next/link";
import { DocumentPreview } from "@/components/digital-links/DocumentPreview";
import { JournalPreview } from "@/components/digital-links/JournalPreview";
import { TransactionPreview } from "@/components/digital-links/TransactionPreview";
import { useDigitalLinkDocument, useDigitalLinkJournal, useDigitalLinkTransaction } from "@/hooks/useDigitalLinks";
import { useDigitalLinkEops, useDigitalLinkFinal, useDigitalLinkQuarterly } from "@/hooks/useDigitalLinksITSA";
import type { DigitalLinks } from "@/lib/audit";
import {
  eopsFrom,
  finalFrom,
  itsaDocumentFrom,
  itsaJournalFrom,
  itsaLinkedEntities,
  itsaTransactionFrom,
  quarterlyFrom,
  type ItsaTimelineNode,
} from "@/lib/digital-links-itsa";
import { EopsPreview } from "./EopsPreview";
import { FinalDeclarationPreview } from "./FinalDeclarationPreview";
import { JsonDiffViewer } from "./JsonDiffViewer";
import { LinkedEntitiesPanel } from "./LinkedEntitiesPanel";
import { QuarterlyPreview } from "./QuarterlyPreview";

export function DigitalLinkDetailPanelITSA({
  node,
  links,
}: {
  node: ItsaTimelineNode;
  links: DigitalLinks;
}) {
  const documentQuery = useDigitalLinkDocument(node.kind === "document" ? node.id : null);
  const bankQuery = useDigitalLinkTransaction(node.kind === "bank" ? node.id : null);
  const journalQuery = useDigitalLinkJournal(node.kind === "journal" ? node.id : null);
  const quarterlyQuery = useDigitalLinkQuarterly(node.kind === "quarterly" ? node.id : null);
  const eopsQuery = useDigitalLinkEops(node.kind === "eops" ? node.id : null);
  const finalQuery = useDigitalLinkFinal(node.kind === "final" ? node.id : null);

  const document =
    node.kind === "document"
      ? itsaDocumentFrom(links.document, { ...documentQuery.data, ...((links.extraction.detail ?? {}) as Record<string, unknown>) })
      : null;
  const transaction = node.kind === "bank" ? itsaTransactionFrom(links.bankTransaction, bankQuery.data) : null;
  const journal = node.kind === "journal" ? itsaJournalFrom(links.journalEntry, journalQuery.data) : null;
  const quarterly = node.kind === "quarterly" ? quarterlyFrom(links.quarterlyUpdate, quarterlyQuery.data) : null;
  const eops = node.kind === "eops" ? eopsFrom(links.eops, eopsQuery.data) : null;
  const declaration = node.kind === "final" ? finalFrom(links.finalDeclaration, finalQuery.data) : null;

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
      <div className="mt-5 space-y-6">
        {node.status === "missing" ? (
          <p className="text-sm text-ink-muted">
            This ITSA step is not linked yet. Attach a document or complete the filing to finish the HMRC digital link.
          </p>
        ) : null}
        {document ? <DocumentPreview document={document} /> : null}
        {transaction ? <TransactionPreview transaction={transaction} /> : null}
        {journal ? <JournalPreview journal={journal} /> : null}
        {quarterly ? <QuarterlyPreview quarterly={quarterly} /> : null}
        {eops ? <EopsPreview eops={eops} /> : null}
        {declaration ? <FinalDeclarationPreview declaration={declaration} /> : null}
        {quarterly || eops || declaration ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Submission snapshot</p>
            <JsonDiffViewer
              before={null}
              after={quarterly?.rawPayload ?? eops?.rawPayload ?? declaration?.calculation ?? declaration?.rawPayload ?? null}
            />
          </div>
        ) : null}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">Linked entities</p>
          <LinkedEntitiesPanel entities={itsaLinkedEntities(links)} />
        </div>
      </div>
    </section>
  );
}
