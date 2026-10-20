"use client";

import { useMemo, useState } from "react";
import { BankWorkspaceNav } from "@/components/BankWorkspaceNav";
import { DocumentFilters } from "@/components/DocumentFilters";
import { DocumentList } from "@/components/DocumentList";
import { ErrorBanner } from "@/components/ErrorBanner";
import { FirmStatsCard } from "@/components/FirmStatsCard";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { ReceiptPreviewModal } from "@/components/ReceiptPreviewModal";
import { ReceiptsSubNav } from "@/components/ReceiptsSubNav";
import { useClientReceipts, useReceiptEvidence } from "@/hooks/useReceipts";
import { useSession } from "@/hooks/useSession";
import { EMPTY_RECEIPT_FILTERS, filterReceipts, receiptAttachmentKind, type ReceiptRecord } from "@/lib/receipts";
import { isPracticeStaff } from "@/lib/session";

export function ReceiptDashboard({ basePath, staffNav = false }: { basePath: string; staffNav?: boolean }) {
  const { clientId, user } = useSession();
  const receipts = useClientReceipts(clientId);
  const evidence = useReceiptEvidence(clientId);
  const [filters, setFilters] = useState(EMPTY_RECEIPT_FILTERS);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [preview, setPreview] = useState<ReceiptRecord | null>(null);

  const rows = useMemo(() => filterReceipts(receipts.data?.receipts ?? [], filters), [filters, receipts.data]);
  const attached = (receipts.data?.receipts ?? []).filter((row) => receiptAttachmentKind(row) !== "unattached").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">HMRC digital records</p>
          <h2 className="mt-1 text-2xl font-semibold text-ink">Receipts</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Upload JPG, PNG, or PDF receipts, preview OCR, and attach them to bank lines, invoices, bills, or journals.
          </p>
        </div>
        <div className="flex flex-col items-end gap-3">
          {staffNav && isPracticeStaff(user?.role) ? <BankWorkspaceNav /> : null}
          <ReceiptsSubNav basePath={basePath} />
        </div>
      </div>
      {!clientId ? (
        <ErrorBanner title="Select a client" message="Choose a client to upload and attach receipts." />
      ) : receipts.isError ? (
        <ErrorBanner title="Receipts unavailable" message={receipts.error.message} />
      ) : receipts.isLoading ? (
        <LoadingSpinner label="Loading receipts…" />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <FirmStatsCard label="Stored" value={receipts.data?.count ?? 0} hint="JPG, PNG and PDF files" />
            <FirmStatsCard label="Attached" value={attached} hint="Linked to a bookkeeping record" />
            <FirmStatsCard
              label="VAT / ITSA evidence"
              value={evidence.data?.receiptsAttached ?? 0}
              hint={
                evidence.data
                  ? `Box 4 proof ${evidence.data.vat.box4.withProof}/${evidence.data.vat.box4.items}`
                  : "Digital record counts"
              }
            />
          </div>
          <DocumentFilters value={filters} onChange={setFilters} />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-muted">
              {rows.length} of {receipts.data?.count ?? 0} receipts
            </p>
            <div className="flex gap-2">
              {(["grid", "list"] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setLayout(item)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold capitalize ${
                    layout === item ? "bg-teal text-white" : "border border-line bg-white text-ink hover:border-teal/40"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <DocumentList
            receipts={rows}
            layout={layout}
            hrefFor={(receipt) => `${basePath}/${receipt.id}`}
            onPreview={setPreview}
            empty="No receipts match these filters. Try clearing search or upload a file."
          />
          <ReceiptPreviewModal receipt={preview} onClose={() => setPreview(null)} />
        </>
      )}
    </div>
  );
}
