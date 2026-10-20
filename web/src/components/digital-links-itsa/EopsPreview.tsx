"use client";

import { formatDate, formatMoney } from "@/lib/format";
import type { CategoryAmount, EopsDetail } from "@/lib/digital-links-itsa";

export function EopsPreview({ eops }: { eops: EopsDetail }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Tax year" value={eops.taxYear ?? "—"} />
        <Field label="Business type" value={eops.typeOfBusiness ?? "—"} />
        <Field label="Period start" value={formatDate(eops.periodStart)} />
        <Field label="Period end" value={formatDate(eops.periodEnd)} />
        <Field label="Finalised" value={eops.finalised ? "Yes" : "No"} />
        <Field label="Status" value={eops.status ?? "—"} />
        <Field label="HMRC submission ID" value={eops.hmrcSubmissionId ?? "—"} />
      </dl>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Period summary</p>
        <dl className="mt-2 grid grid-cols-2 gap-3 text-sm">
          <Field label="Year" value={String(eops.summary.taxYear ?? eops.taxYear ?? "—")} />
          <Field label="Type" value={String(eops.summary.typeOfBusiness ?? eops.typeOfBusiness ?? "—")} />
        </dl>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Adjustments</p>
        {eops.adjustments.length ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-line">
            {eops.adjustments.map((row: CategoryAmount) => (
              <div key={row.id} className="flex items-center justify-between border-t border-line px-3 py-2 text-sm first:border-0">
                <span className="text-ink-muted">{row.label}</span>
                <span className="font-medium text-ink">{formatMoney(row.value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">No EOPS adjustments recorded.</p>
        )}
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
