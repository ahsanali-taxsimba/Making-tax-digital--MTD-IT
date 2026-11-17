"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  useConfirmExtraction,
  useExtractionAudit,
  useInvoiceExtraction,
  useRejectExtraction,
  useReprocessExtraction,
  useSaveExtractionDraft,
} from "@/hooks/useInvoiceExtraction";
import { useAttachments, useRemoveAttachment, useUploadAttachment } from "@/hooks/useAttachments";
import { useSession } from "@/hooks/useSession";
import {
  extractionDiffers,
  formFromExtracted,
  reviewStatusLabel,
  validateExtractionForm,
  type ExtractionForm,
} from "@/lib/invoice-extraction";
import { ErrorBanner } from "../ErrorBanner";
import { LoadingSpinner } from "../LoadingSpinner";
import { SuccessBanner } from "../SuccessBanner";
import { ApprovalButtons } from "./ApprovalButtons";
import { AttachmentPanel } from "./AttachmentPanel";
import { AuditLogPanel } from "./AuditLogPanel";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { DocumentViewer } from "./DocumentViewer";
import { ExtractedInvoiceForm } from "./ExtractedInvoiceForm";

export function InvoiceExtractionWorkspace({ documentId }: { documentId: string }) {
  const router = useRouter();
  const { clientId } = useSession();
  const extraction = useInvoiceExtraction(documentId);
  const audit = useExtractionAudit(documentId);
  const confirm = useConfirmExtraction(documentId, extraction.data?.clientId ?? clientId);
  const saveDraft = useSaveExtractionDraft(documentId, extraction.data?.clientId ?? clientId);
  const reject = useRejectExtraction(documentId, extraction.data?.clientId ?? clientId);
  const reprocess = useReprocessExtraction(documentId, extraction.data?.clientId ?? clientId);
  const attachments = useAttachments({
    clientId: extraction.data?.clientId ?? clientId,
    documentId,
    invoiceId: extraction.data?.invoiceId,
    billId: extraction.data?.billId,
  });
  const upload = useUploadAttachment({
    clientId: extraction.data?.clientId ?? clientId,
    documentId,
    invoiceId: extraction.data?.invoiceId,
    billId: extraction.data?.billId,
  });
  const remove = useRemoveAttachment();
  const [form, setForm] = useState<ExtractionForm>(() => formFromExtracted(extraction.data?.extracted));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (extraction.data?.extracted) {
      setForm(formFromExtracted(extraction.data.extracted));
    }
  }, [extraction.data]);

  const dirty = useMemo(() => extractionDiffers(extraction.data?.extracted, form), [extraction.data?.extracted, form]);
  const approved = extraction.data?.reviewStatus === "approved";
  const rejected = extraction.data?.reviewStatus === "rejected";

  async function onApprove() {
    const nextErrors = validateExtractionForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      return;
    }
    const result = await confirm.mutateAsync(form);
    const id = result.invoice?.id ?? result.bill?.id;
    const kind = result.direction === "sales" ? "sales" : "purchase";
    if (id) {
      router.push(`/invoices/${id}?kind=${kind}`);
    }
  }

  if (extraction.isLoading) {
    return <LoadingSpinner label="Loading extraction…" />;
  }

  if (extraction.isError || !extraction.data) {
    return <ErrorBanner message="Unable to load this invoice extraction." />;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink-muted">Invoice extraction</p>
          <h1 className="mt-1 text-2xl font-semibold text-ink">{extraction.data.fileName}</h1>
          <p className="mt-1 text-sm text-ink-muted">{reviewStatusLabel(extraction.data.reviewStatus)}</p>
        </div>
        <ConfidenceBadge value={extraction.data.confidence} />
      </header>

      {dirty && !approved ? (
        <div className="rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm text-warning" role="status">
          <p className="font-semibold">Differences detected</p>
          <p className="mt-1">Accountant edits differ from the original extracted fields. Save a draft or approve to keep them.</p>
        </div>
      ) : null}
      {approved ? (
        <SuccessBanner title="Ready to post" message="This extraction has been approved. Open the invoice to post it to the ledger." />
      ) : null}
      {rejected ? <ErrorBanner title="Extraction rejected" message="Re-run extraction after checking the original document." /> : null}
      {message ? <SuccessBanner title="Saved" message={message} /> : null}
      {confirm.isError ? <ErrorBanner message={confirm.error instanceof Error ? confirm.error.message : "Unable to approve this extraction."} /> : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <DocumentViewer documentId={documentId} fileName={extraction.data.fileName} fileType={extraction.data.fileType} />
        <section className="rounded-2xl border border-line bg-white p-5">
          <ExtractedInvoiceForm
            form={form}
            extracted={extraction.data.extracted}
            errors={errors}
            readOnly={approved}
            onChange={setForm}
          />
          {!approved ? (
            <div className="mt-5">
              <ApprovalButtons
                approving={confirm.isPending}
                saving={saveDraft.isPending}
                rejecting={reject.isPending}
                reprocessing={reprocess.isPending}
                onApprove={() => void onApprove()}
                onDraft={() => {
                  void saveDraft.mutateAsync(form).then(() => setMessage("Draft extraction saved."));
                }}
                onReject={() => {
                  const reason = window.prompt("Reason for rejecting this extraction?", "Fields do not match the document") ?? undefined;
                  if (reason !== undefined) {
                    void reject.mutateAsync(reason);
                  }
                }}
                onReprocess={() => void reprocess.mutateAsync(form.direction)}
              />
            </div>
          ) : (
            <button
              type="button"
              className="mt-5 rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white"
              onClick={() =>
                router.push(
                  `/invoices/${extraction.data.invoiceId ?? extraction.data.billId}?kind=${extraction.data.invoiceId ? "sales" : "purchase"}`,
                )
              }
            >
              Open invoice
            </button>
          )}
        </section>
      </div>

      <AttachmentPanel
        documents={attachments.data?.documents ?? []}
        uploading={upload.isPending}
        onUpload={(file) => void upload.mutateAsync(file)}
        onRemove={(id) => void remove.mutateAsync(id)}
      />
      <AuditLogPanel entries={audit.data ?? extraction.data.audit ?? []} />
    </div>
  );
}
