"use client";

export function ApprovalButtons({
  onApprove,
  onDraft,
  onReject,
  onReprocess,
  approving,
  saving,
  rejecting,
  reprocessing,
  disabled,
}: {
  onApprove: () => void;
  onDraft: () => void;
  onReject: () => void;
  onReprocess: () => void;
  approving?: boolean;
  saving?: boolean;
  rejecting?: boolean;
  reprocessing?: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={disabled || approving}
        onClick={onApprove}
        className="rounded-lg bg-teal px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {approving ? "Creating invoice…" : "Approve & Create Invoice"}
      </button>
      <button
        type="button"
        disabled={disabled || saving}
        onClick={onDraft}
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save as Draft"}
      </button>
      <button
        type="button"
        disabled={disabled || rejecting}
        onClick={onReject}
        className="rounded-lg border border-danger/30 bg-danger-soft px-4 py-2 text-sm font-semibold text-danger disabled:opacity-60"
      >
        {rejecting ? "Rejecting…" : "Reject Extraction"}
      </button>
      <button
        type="button"
        disabled={reprocessing}
        onClick={onReprocess}
        className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink disabled:opacity-60"
      >
        {reprocessing ? "Re-running…" : "Re-run Extraction"}
      </button>
    </div>
  );
}
