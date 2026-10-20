"use client";

import { formatMoney } from "@/lib/format";
import type { FinalDeclarationDetail } from "@/lib/digital-links-itsa";

export function FinalDeclarationPreview({ declaration }: { declaration: FinalDeclarationDetail }) {
  const rows = Object.entries(declaration.calculation);
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Tax year" value={declaration.taxYear ?? "—"} />
        <Field label="Status" value={declaration.status ?? "—"} />
        <Field label="Finalised" value={declaration.finalised ? "Yes" : "No"} />
        <Field label="Calculation ID" value={declaration.calculationId ?? "—"} />
        <Field label="HMRC submission ID" value={declaration.hmrcSubmissionId ?? "—"} />
      </dl>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-muted">Full tax calculation</p>
        {rows.length ? (
          <div className="mt-2 overflow-hidden rounded-xl border border-line">
            {rows.map(([key, value]) => (
              <div key={key} className="flex items-center justify-between border-t border-line px-3 py-2 text-sm first:border-0">
                <span className="text-ink-muted">{label(key)}</span>
                <span className="font-medium text-ink">{moneyOrText(value)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-sm text-ink-muted">No calculation snapshot stored on this declaration.</p>
        )}
      </div>
    </div>
  );
}

function moneyOrText(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "number" || (typeof value === "string" && value !== "" && Number.isFinite(Number(value)))) {
    return formatMoney(Number(value));
  }
  if (typeof value === "boolean") {
    return value ? "Yes" : "No";
  }
  return String(value);
}

function label(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 break-all text-ink">{value}</dd>
    </div>
  );
}
