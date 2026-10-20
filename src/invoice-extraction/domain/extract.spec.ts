import { extractInvoiceFromText } from "./extract";
import { extractLineItems } from "./line-items";
import { reconcileInvoice } from "./reconcile";

const SAMPLE = `
North Ads Agency Ltd
12 Ship Street
Brighton BN1 1AE

Invoice No: INV-4412
Invoice Date: 21/01/2026
Due Date: 04/02/2026

Description Qty Unit Net VAT Gross
Design work 1 400.00 400.00 80.00 480.00
Hosting 2 12.00 24.00 4.80 28.80

Subtotal £424.00
VAT 20% £84.80
Total £508.80
`;

describe("invoice extraction engine", () => {
  it("extracts UK invoice fields, lines, VAT and ITSA mapping", () => {
    const result = extractInvoiceFromText(SAMPLE);
    expect(result.supplierName).toMatch(/North Ads Agency/i);
    expect(result.supplierAddress).toMatch(/BN1/i);
    expect(result.invoiceNumber).toBe("INV-4412");
    expect(result.invoiceDate).toBe("2026-01-21");
    expect(result.dueDate).toBe("2026-02-04");
    expect(result.currency).toBe("GBP");
    expect(result.subtotal).toBe(424);
    expect(result.vatTotal).toBe(84.8);
    expect(result.grandTotal).toBe(508.8);
    expect(result.lineItems).toHaveLength(2);
    expect(result.lineItems[0]).toMatchObject({ description: "Design work", quantity: 1, net: 400, vat: 80, gross: 480 });
    expect(result.direction).toBe("purchase");
    expect(result.vatBoxes).toEqual(expect.arrayContaining(["box_4", "box_7"]));
    expect(result.itsaCategory).toBeTruthy();
    expect(result.confidence).toBeGreaterThan(0.7);
    expect(result.issues).toEqual([]);
  });

  it("flags reconciliation errors when totals do not match lines", () => {
    const lines = extractLineItems("Widget 1 100.00 100.00 20.00 120.00");
    const result = reconcileInvoice({ lineItems: lines, subtotal: 50, vatTotal: 5, grandTotal: 999 });
    expect(result.lineNetOk).toBe(false);
    expect(result.totalOk).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("treats sales invoices as output VAT (box 1)", () => {
    const result = extractInvoiceFromText("Sales invoice\nInvoice No INV-9\nDate 2026-03-01\nTotal £120.00", { direction: "sales" });
    expect(result.direction).toBe("sales");
    expect(result.vatBoxes).toEqual(expect.arrayContaining(["box_1", "box_6"]));
  });
});
