"use client";

import { formatDate, formatMoney } from "@/lib/format";
import type { CategoryAmount, QuarterlyDetail } from "@/lib/digital-links-itsa";

export function QuarterlyPreview({ quarterly }: { quarterly: QuarterlyDetail }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Tax year" value={quarterly.taxYear ?? "—"} />
        <Field label="Period" value={quarterly.periodId ?? "—"} />
        <Field label="Start" value={formatDate(quarterly.periodStart)} />
        <Field label="End" value={formatDate(quarterly.periodEnd)} />
        <Field label="Status" value={quarterly.status ?? "—"} />
        <Field label="HMRC submission ID" value={quarterly.hmrcSubmissionId ?? "—"} />
      </dl>
      <CategoryList title="Income categories" rows={quarterly.incomes} empty="No income categories on this update." />
      <CategoryList title="Expense categories" rows={quarterly.expenses} empty="No expense categories on this update." />
      <CategoryList title="Adjustments" rows={quarterly.adjustments} empty="No adjustments recorded." />
    </div>
  );
}

function CategoryList({ title, rows, empty }: { title: string; rows: CategoryAmount[]; empty: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</p>
      {rows.length ? (
        <div className="mt-2 overflow-hidden rounded-xl border border-line">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between border-t border-line px-3 py-2 text-sm first:border-0">
              <span className="text-ink-muted">{row.label}</span>
              <span className="font-medium text-ink">{formatMoney(row.value)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-1 text-sm text-ink-muted">{empty}</p>
      )}
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
