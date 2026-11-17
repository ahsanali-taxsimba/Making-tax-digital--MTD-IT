"use client";

import { applyLineNet, calcLineGross, calcTotals, emptyLine, type ExtractedLineItem } from "@/lib/invoice-extraction";
import { formatMoney } from "@/lib/format";
import { ConfidenceBadge } from "./ConfidenceBadge";

export function LineItemsTable({
  lines,
  onChange,
  readOnly = false,
}: {
  lines: ExtractedLineItem[];
  onChange?: (lines: ExtractedLineItem[]) => void;
  readOnly?: boolean;
}) {
  const totals = calcTotals(lines);

  function update(index: number, patch: Partial<ExtractedLineItem>) {
    if (!onChange) {
      return;
    }
    onChange(lines.map((line, current) => (current === index ? { ...line, ...patch, gross: calcLineGross({ ...line, ...patch }) } : line)));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-left text-sm">
        <thead className="bg-paper text-xs uppercase tracking-wide text-ink-muted">
          <tr>
            <th className="px-3 py-2 font-semibold">Description</th>
            <th className="px-3 py-2 font-semibold">Qty</th>
            <th className="px-3 py-2 font-semibold">Net</th>
            <th className="px-3 py-2 font-semibold">VAT</th>
            <th className="px-3 py-2 font-semibold">Gross</th>
            <th className="px-3 py-2 font-semibold"> </th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={line.id ?? index} className="border-t border-line">
              <td className="px-3 py-2">
                {readOnly ? (
                  <span>{line.description || "—"}</span>
                ) : (
                  <input
                    className="w-full rounded-lg border border-line px-2 py-1"
                    value={line.description}
                    onChange={(event) => update(index, { description: event.target.value })}
                  />
                )}
              </td>
              <td className="px-3 py-2">
                {readOnly ? (
                  line.quantity ?? 1
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="1"
                    className="w-16 rounded-lg border border-line px-2 py-1"
                    value={line.quantity ?? 1}
                    onChange={(event) => update(index, { quantity: Number(event.target.value) })}
                  />
                )}
              </td>
              <td className="px-3 py-2">
                {readOnly ? (
                  formatMoney(line.net)
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-24 rounded-lg border border-line px-2 py-1"
                    value={line.net ?? 0}
                    onChange={(event) => onChange?.(lines.map((item, current) => (current === index ? applyLineNet(item, Number(event.target.value)) : item)))}
                  />
                )}
              </td>
              <td className="px-3 py-2">
                {readOnly ? (
                  formatMoney(line.vat)
                ) : (
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    className="w-20 rounded-lg border border-line px-2 py-1"
                    value={line.vat ?? 0}
                    onChange={(event) => update(index, { vat: Number(event.target.value) })}
                  />
                )}
              </td>
              <td className="px-3 py-2 font-medium">{formatMoney(calcLineGross(line))}</td>
              <td className="px-3 py-2 text-right">
                <ConfidenceBadge value={line.confidence} compact />
                {!readOnly ? (
                  <button
                    type="button"
                    className="ml-2 text-xs font-semibold text-danger"
                    onClick={() => onChange?.(lines.filter((_, current) => current !== index))}
                  >
                    Remove
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-3 py-3 text-sm">
        {!readOnly ? (
          <button type="button" className="font-semibold text-teal" onClick={() => onChange?.([...lines, emptyLine()])}>
            Add line item
          </button>
        ) : (
          <span />
        )}
        <dl className="flex flex-wrap gap-4">
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
      </div>
    </div>
  );
}
