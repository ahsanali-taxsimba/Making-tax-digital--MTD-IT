"use client";

import { formatDate, formatMoney } from "@/lib/format";
import type { VatReturnDetail } from "@/lib/digital-links";

export function VatReturnPreview({ vatReturn }: { vatReturn: VatReturnDetail }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Period" value={vatReturn.periodKey ?? "—"} />
        <Field label="Status" value={vatReturn.status ?? "—"} />
        <Field label="Start" value={formatDate(vatReturn.periodStart)} />
        <Field label="End" value={formatDate(vatReturn.periodEnd)} />
        <Field label="HMRC submission ID" value={vatReturn.hmrcSubmissionId ?? "—"} />
      </dl>
      <div className="overflow-hidden rounded-xl border border-line">
        {vatReturn.boxes.map((box) => (
          <div key={box.id} className="flex items-center justify-between border-t border-line px-3 py-2 text-sm first:border-0">
            <span className="text-ink-muted">{box.label}</span>
            <span className="font-medium text-ink">{formatMoney(box.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-ink">{value}</dd>
    </div>
  );
}
