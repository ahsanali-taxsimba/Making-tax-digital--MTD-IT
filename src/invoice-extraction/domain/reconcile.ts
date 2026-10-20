import { money, sumMoney } from "../../bookkeeping/domain/money";
import { ExtractedInvoice, ReconciliationResult } from "./types";

const TOLERANCE = 0.06;

export function reconcileInvoice(extracted: Pick<ExtractedInvoice, "lineItems" | "subtotal" | "vatTotal" | "grandTotal">): ReconciliationResult {
  const lineNet = sumMoney(extracted.lineItems.map((line) => line.net ?? 0));
  const lineVat = sumMoney(extracted.lineItems.map((line) => line.vat ?? 0));
  const lineGross = sumMoney(extracted.lineItems.map((line) => line.gross ?? (line.net ?? 0) + (line.vat ?? 0)));
  const issues: string[] = [];
  const lineNetOk = extracted.subtotal == null || extracted.lineItems.length === 0 || near(lineNet, extracted.subtotal);
  const lineVatOk = extracted.vatTotal == null || extracted.lineItems.length === 0 || near(lineVat, extracted.vatTotal);
  const totalOk =
    extracted.grandTotal == null ||
    (extracted.subtotal != null && extracted.vatTotal != null
      ? near(extracted.subtotal + extracted.vatTotal, extracted.grandTotal)
      : extracted.lineItems.length === 0 || near(lineGross, extracted.grandTotal));
  if (!lineNetOk) {
    issues.push(`line_net_mismatch:${lineNet}!=${extracted.subtotal}`);
  }
  if (!lineVatOk) {
    issues.push(`line_vat_mismatch:${lineVat}!=${extracted.vatTotal}`);
  }
  if (!totalOk) {
    issues.push(`total_mismatch:${extracted.subtotal}+${extracted.vatTotal}!=${extracted.grandTotal}`);
  }
  return { lineNetOk, lineVatOk, totalOk, issues };
}

function near(left: number, right: number): boolean {
  return Math.abs(money(left) - money(right)) <= TOLERANCE;
}
