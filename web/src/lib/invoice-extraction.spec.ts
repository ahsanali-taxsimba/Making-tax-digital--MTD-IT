import {
  applyLineNet,
  auditActionLabel,
  calcTotals,
  confidenceTone,
  confirmPayload,
  emptyLine,
  extractionDiffers,
  fieldState,
  formFromExtracted,
  reviewStatusLabel,
  validateExtractionForm,
  type ExtractedInvoice,
} from "./invoice-extraction";

const extracted: ExtractedInvoice = {
  supplierName: "North Ads Agency Ltd",
  supplierAddress: "12 Ship Street",
  supplierId: "p1",
  customerName: null,
  invoiceNumber: "INV-4412",
  invoiceDate: "2026-01-21",
  dueDate: "2026-02-04",
  currency: "GBP",
  lineItems: [{ description: "Design work", quantity: 1, unitPrice: 400, net: 400, vat: 80, vatRate: 20, gross: 480, confidence: 0.9 }],
  subtotal: 400,
  vatTotal: 80,
  grandTotal: 480,
  direction: "purchase",
  vatBoxes: ["box_4", "box_7"],
  itsaCategory: "advertising",
  itsaBucket: "expenses",
  issues: [],
  fieldConfidence: {
    supplierName: 0.9,
    supplierAddress: 0.7,
    invoiceNumber: 0.95,
    invoiceDate: 0.9,
    dueDate: 0.8,
    lineItems: 0.9,
    subtotal: 0.9,
    vatTotal: 0.88,
    grandTotal: 0.92,
  },
  confidence: 0.9,
  source: "ocr",
};

describe("invoice extraction review helpers", () => {
  it("auto-calculates line and document totals", () => {
    const line = applyLineNet(emptyLine(), 250);
    expect(line.vat).toBe(50);
    expect(line.gross).toBe(300);
    expect(calcTotals([line, applyLineNet(emptyLine(), 10)])).toEqual({ subtotal: 260, vatTotal: 52, grandTotal: 312 });
  });

  it("flags missing and low-confidence fields", () => {
    expect(fieldState("", 0.95)).toBe("missing");
    expect(fieldState("INV-1", 0.4)).toBe("low");
    expect(fieldState("INV-1", 0.9)).toBe("ok");
    expect(confidenceTone(0.91)).toBe("high");
    expect(confidenceTone(0.7)).toBe("medium");
  });

  it("detects accountant edits against the original extraction", () => {
    const form = formFromExtracted(extracted);
    expect(extractionDiffers(extracted, form)).toBe(false);
    form.supplierName = "North Ads Ltd";
    expect(extractionDiffers(extracted, form)).toBe(true);
  });

  it("validates required fields before approval", () => {
    const errors = validateExtractionForm(formFromExtracted({ ...extracted, supplierName: null, invoiceDate: null, lineItems: [] }));
    expect(errors.supplierName).toBeDefined();
    expect(errors.invoiceDate).toBeDefined();
    expect(errors.lineItems).toBeDefined();
    expect(validateExtractionForm(formFromExtracted(extracted))).toEqual({});
  });

  it("builds a confirm payload and labels review states", () => {
    const payload = confirmPayload(formFromExtracted(extracted));
    expect(payload.invoiceNumber).toBe("INV-4412");
    expect(payload.lines[0].net).toBe(400);
    expect(reviewStatusLabel("approved")).toBe("Approved");
    expect(auditActionLabel("invoice.extraction.confirmed")).toBe("Confirmed");
  });
});
