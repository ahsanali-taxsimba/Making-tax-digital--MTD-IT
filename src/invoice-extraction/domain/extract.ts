import { ChartProfile } from "@prisma/client";
import { lookupItsaMapping } from "../../itsa/mtd-itsa.mapping";
import { cleanOcrText } from "../../receipts/ocr/clean-text";
import { lookupVatMapping } from "../../vat/vat-box.mapping";
import { scoreFields } from "./confidence";
import { detectDirection, extractCurrency, extractDueDate, extractInvoiceDate, extractInvoiceNumber, extractTotals } from "./fields";
import { extractLineItems } from "./line-items";
import { reconcileInvoice } from "./reconcile";
import { detectSupplier, matchPartyName } from "./supplier";
import { ExtractedInvoice, InvoiceDirection } from "./types";

export function extractInvoiceFromText(
  raw: string,
  options: {
    direction?: InvoiceDirection;
    profile?: ChartProfile;
    parties?: Array<{ id: string; name: string }>;
    source?: "ocr" | "hint";
  } = {},
): ExtractedInvoice {
  const text = cleanOcrText(raw);
  const supplier = detectSupplier(text);
  const invoiceNumber = extractInvoiceNumber(text);
  const invoiceDate = extractInvoiceDate(text);
  const dueDate = extractDueDate(text, invoiceDate);
  const totals = extractTotals(text);
  const lineItems = extractLineItems(text);
  const direction = detectDirection(text, options.direction);
  const reconciliation = reconcileInvoice({ ...totals, lineItems });
  const { fieldConfidence, confidence } = scoreFields({
    supplierName: supplier.name,
    supplierAddress: supplier.address,
    invoiceNumber,
    invoiceDate,
    dueDate,
    lineItems: lineItems.length,
    labelledTotals: {
      subtotal: totals.subtotal != null,
      vatTotal: totals.vatTotal != null,
      grandTotal: totals.grandTotal != null,
    },
    reconciliation,
  });
  const profile = options.profile ?? ChartProfile.SOLE_TRADER;
  const ledgerCode = direction === "sales" ? 1000 : 3000;
  const vat = lookupVatMapping(profile, ledgerCode);
  const itsa = lookupItsaMapping(profile, ledgerCode);
  const party = matchPartyName(supplier.name, options.parties ?? []);
  const subtotal = totals.subtotal ?? (lineItems.length ? sum(lineItems.map((line) => line.net)) : null);
  const vatTotal = totals.vatTotal ?? (lineItems.length ? sum(lineItems.map((line) => line.vat)) : null);
  const grandTotal =
    totals.grandTotal ??
    (subtotal != null && vatTotal != null ? Number((subtotal + vatTotal).toFixed(2)) : null);

  return {
    supplierName: supplier.name,
    supplierAddress: supplier.address,
    supplierId: party?.id ?? null,
    customerName: direction === "sales" ? supplier.name : null,
    invoiceNumber,
    invoiceDate,
    dueDate,
    currency: extractCurrency(text),
    lineItems,
    subtotal,
    vatTotal,
    grandTotal,
    direction,
    vatBoxes: Array.from(new Set([...(vat?.boxes ?? []), ...(direction === "sales" ? ["box_1", "box_6"] : ["box_4", "box_7"])])),
    itsaCategory: itsa?.category ?? (direction === "sales" ? "Turnover" : "Advertising and Business Promotion"),
    itsaBucket: itsa?.bucket ?? null,
    issues: reconciliation.issues,
    fieldConfidence,
    confidence,
    source: options.source ?? "ocr",
  };
}

function sum(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value != null);
  if (!present.length) {
    return null;
  }
  return Number(present.reduce((total, value) => total + value, 0).toFixed(2));
}
