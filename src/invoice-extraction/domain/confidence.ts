import { money } from "../../bookkeeping/domain/money";
import { FieldConfidence, ReconciliationResult } from "./types";

export function scoreFields(input: {
  supplierName: string | null;
  supplierAddress: string | null;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  dueDate: string | null;
  lineItems: number;
  labelledTotals: { subtotal: boolean; vatTotal: boolean; grandTotal: boolean };
  reconciliation: ReconciliationResult;
}): { fieldConfidence: FieldConfidence; confidence: number } {
  const fieldConfidence: FieldConfidence = {
    supplierName: input.supplierName ? 0.88 : 0.2,
    supplierAddress: input.supplierAddress ? 0.7 : 0.15,
    invoiceNumber: input.invoiceNumber ? 0.93 : 0.25,
    invoiceDate: input.invoiceDate ? 0.9 : 0.2,
    dueDate: input.dueDate ? 0.82 : 0.25,
    lineItems: input.lineItems > 0 ? Math.min(0.92, 0.6 + input.lineItems * 0.08) : 0.2,
    subtotal: input.labelledTotals.subtotal ? 0.9 : 0.45,
    vatTotal: input.labelledTotals.vatTotal ? 0.88 : 0.4,
    grandTotal: input.labelledTotals.grandTotal ? 0.92 : 0.5,
  };
  const values = Object.values(fieldConfidence);
  let confidence = money(values.reduce((sum, value) => sum + value, 0) / values.length);
  if (input.reconciliation.lineNetOk && input.reconciliation.lineVatOk && input.reconciliation.totalOk) {
    confidence = Math.min(0.99, money(confidence + 0.08));
  } else {
    confidence = Math.max(0.28, money(confidence - 0.12 * input.reconciliation.issues.length));
  }
  return { fieldConfidence, confidence };
}
