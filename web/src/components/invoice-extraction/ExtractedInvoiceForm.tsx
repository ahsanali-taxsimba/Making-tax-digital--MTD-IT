"use client";

import { calcTotals, fieldHighlightClass, fieldState, type ExtractionForm, type ExtractedInvoice } from "@/lib/invoice-extraction";
import { formatMoney } from "@/lib/format";
import { ConfidenceBadge } from "./ConfidenceBadge";
import { LineItemsTable } from "./LineItemsTable";

function Field({
  label,
  value,
  confidence,
  type = "text",
  onChange,
  error,
  readOnly,
}: {
  label: string;
  value: string;
  confidence?: number;
  type?: string;
  onChange?: (value: string) => void;
  error?: string;
  readOnly?: boolean;
}) {
  const state = fieldState(value, confidence);
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-ink-muted">
        {label}
        <ConfidenceBadge value={confidence} compact />
      </span>
      {readOnly ? (
        <p className={`rounded-lg border px-3 py-2 text-sm ${fieldHighlightClass(state)}`}>{value || "Missing"}</p>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          className={`w-full rounded-lg border px-3 py-2 text-sm ${fieldHighlightClass(state)}`}
        />
      )}
      {error ? <p className="mt-1 text-xs text-danger">{error}</p> : null}
      {state === "low" && !error ? <p className="mt-1 text-xs text-warning">Low confidence — check against the original document.</p> : null}
    </label>
  );
}

export function ExtractedInvoiceForm({
  form,
  extracted,
  errors,
  onChange,
  readOnly = false,
}: {
  form: ExtractionForm;
  extracted?: ExtractedInvoice | null;
  errors?: Record<string, string>;
  onChange?: (form: ExtractionForm) => void;
  readOnly?: boolean;
}) {
  const confidence = extracted?.fieldConfidence;
  const totals = calcTotals(form.lineItems);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-ink-muted">Direction</span>
          <select
            disabled={readOnly}
            value={form.direction}
            onChange={(event) => onChange?.({ ...form, direction: event.target.value as ExtractionForm["direction"] })}
            className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm"
          >
            <option value="purchase">Purchase bill</option>
            <option value="sales">Sales invoice</option>
          </select>
        </label>
        <Field
          label="Supplier name"
          value={form.supplierName}
          confidence={confidence?.supplierName}
          error={errors?.supplierName}
          readOnly={readOnly}
          onChange={(supplierName) => onChange?.({ ...form, supplierName })}
        />
        <Field
          label="Invoice number"
          value={form.invoiceNumber}
          confidence={confidence?.invoiceNumber}
          readOnly={readOnly}
          onChange={(invoiceNumber) => onChange?.({ ...form, invoiceNumber })}
        />
        <Field
          label="Invoice date"
          type="date"
          value={form.invoiceDate}
          confidence={confidence?.invoiceDate}
          error={errors?.invoiceDate}
          readOnly={readOnly}
          onChange={(invoiceDate) => onChange?.({ ...form, invoiceDate })}
        />
        <Field
          label="Due date"
          type="date"
          value={form.dueDate}
          confidence={confidence?.dueDate}
          readOnly={readOnly}
          onChange={(dueDate) => onChange?.({ ...form, dueDate })}
        />
        <div className="sm:col-span-2">
          <Field
            label="Supplier address"
            value={form.supplierAddress}
            confidence={confidence?.supplierAddress}
            readOnly={readOnly}
            onChange={(supplierAddress) => onChange?.({ ...form, supplierAddress })}
          />
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-ink">Line items</h3>
          <ConfidenceBadge value={confidence?.lineItems} />
        </div>
        <LineItemsTable
          lines={form.lineItems}
          readOnly={readOnly}
          onChange={(lineItems) => onChange?.({ ...form, lineItems })}
        />
        {errors?.lineItems ? <p className="mt-2 text-xs text-danger">{errors.lineItems}</p> : null}
      </div>

      <dl className="grid gap-3 rounded-xl border border-line bg-paper px-4 py-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-ink-muted">Subtotal</dt>
          <dd className="font-semibold">{formatMoney(totals.subtotal)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">VAT</dt>
          <dd className="font-semibold">{formatMoney(totals.vatTotal)}</dd>
        </div>
        <div>
          <dt className="text-xs text-ink-muted">Total</dt>
          <dd className="font-semibold">{formatMoney(totals.grandTotal)}</dd>
        </div>
      </dl>
      {extracted?.vatBoxes?.length ? (
        <p className="text-xs text-ink-muted">VAT boxes: {extracted.vatBoxes.join(", ")}</p>
      ) : null}
      {extracted?.itsaCategory ? (
        <p className="text-xs text-ink-muted">
          ITSA: {extracted.itsaCategory}
          {extracted.itsaBucket ? ` · ${extracted.itsaBucket}` : ""}
        </p>
      ) : null}
    </div>
  );
}
