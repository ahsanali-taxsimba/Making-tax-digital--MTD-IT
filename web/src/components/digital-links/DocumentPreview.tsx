"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchDocumentPreview, type DocumentDetail } from "@/lib/digital-links";
import { formatDate, formatMoney } from "@/lib/format";
import { useObjectUrl } from "@/hooks/useObjectUrl";

export function DocumentPreview({ document }: { document: DocumentDetail }) {
  const file = useQuery({
    queryKey: ["digital-link-preview", document.id],
    queryFn: () => fetchDocumentPreview(document.id),
    retry: false,
  });
  const url = useObjectUrl(file.data?.blob ?? null);
  const image = (document.fileType ?? file.data?.contentType ?? "").includes("image");

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-line bg-paper">
        {url && image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={document.fileName} className="mx-auto max-h-56 object-contain" />
        ) : (
          <div className="flex h-36 items-center justify-center text-sm font-semibold text-teal">
            {document.fileType?.toUpperCase() || "FILE"}
          </div>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="File name" value={document.fileName} />
        <Field label="Type" value={document.type ?? document.fileType ?? "—"} />
        <Field label="Uploaded" value={formatDate(document.uploadedAt)} />
        <Field label="Invoice no." value={document.extracted?.invoiceNumber ?? document.ocrInvoiceNumber ?? "—"} />
      </dl>
      {document.extracted ? (
        <div className="rounded-xl border border-line bg-paper p-3 text-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">AI extraction</p>
          <p className="mt-1 font-medium text-ink">{document.extracted.supplier ?? "Supplier not extracted"}</p>
          <p className="text-ink-muted">
            Total {formatMoney(document.extracted.total)} · VAT {formatMoney(document.extracted.vat)}
          </p>
        </div>
      ) : null}
      {document.ocrText ? (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">OCR text</p>
          <p className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-white p-3 text-xs text-ink-muted">
            {document.ocrText.slice(0, 800)}
          </p>
        </div>
      ) : (
        <p className="text-sm text-ink-muted">No OCR text stored on this document.</p>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
