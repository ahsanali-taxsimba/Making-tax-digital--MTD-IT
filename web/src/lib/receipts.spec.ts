import {
  activityLabel,
  dedupeAttachTargets,
  deriveReceiptActivity,
  EMPTY_RECEIPT_FILTERS,
  filterReceipts,
  formatFileSize,
  isAcceptedReceiptFile,
  receiptAttachmentKind,
  receiptAttachmentLabel,
  receiptFileError,
  receiptKindLabel,
  scoreAttachTarget,
  searchAttachTargets,
  suggestAttachTargets,
  type AttachTarget,
  type ReceiptRecord,
} from "./receipts";

const receipt: ReceiptRecord = {
  id: "r1",
  clientId: "c1",
  bankTransactionId: null,
  invoiceId: null,
  billId: "b1",
  journalEntryId: null,
  fileName: "bp-fuel.pdf",
  fileType: "pdf",
  fileSize: 2048,
  storageUrl: "/x",
  uploadedByUserId: "u1",
  uploadedAt: "2026-01-21T10:00:00.000Z",
  tags: ["Fuel"],
  ocrText: "BP Fuel Station Total 48.00 21/01/2026",
  ocrMerchant: "BP",
  ocrAmount: 48,
  ocrDate: "2026-01-21",
  status: "processed",
  proofAvailable: true,
};

describe("receipt helpers", () => {
  it("labels image and PDF types", () => {
    expect(receiptKindLabel("pdf")).toBe("PDF");
    expect(receiptKindLabel("jpg")).toBe("JPG");
  });

  it("accepts JPG, PNG and PDF only", () => {
    expect(isAcceptedReceiptFile({ name: "fuel.jpg", type: "image/jpeg" })).toBe(true);
    expect(isAcceptedReceiptFile({ name: "scan.PNG", type: "" })).toBe(true);
    expect(isAcceptedReceiptFile({ name: "notes.docx", type: "application/vnd.openxmlformats" })).toBe(false);
    expect(receiptFileError({ name: "big.pdf", type: "application/pdf", size: 13 * 1024 * 1024 })).toMatch(/12MB/);
  });

  it("formats file sizes", () => {
    expect(formatFileSize(800)).toBe("800 B");
    expect(formatFileSize(2048)).toBe("2.0 KB");
  });

  it("classifies attachment kind", () => {
    expect(receiptAttachmentKind(receipt)).toBe("bill");
    expect(receiptAttachmentLabel("bank")).toBe("Bank transaction");
    expect(receiptAttachmentLabel("unattached")).toBe("Unattached");
  });

  it("filters by OCR text, merchant, amount, date and attachment", () => {
    const other: ReceiptRecord = {
      ...receipt,
      id: "r2",
      billId: null,
      proofAvailable: false,
      ocrMerchant: "Tesco",
      ocrAmount: 12,
      ocrDate: "2026-02-01",
      ocrText: "Groceries",
      fileName: "tesco.jpg",
      tags: [],
    };
    expect(filterReceipts([receipt, other], { ...EMPTY_RECEIPT_FILTERS, query: "fuel" }).map((row) => row.id)).toEqual(["r1"]);
    expect(filterReceipts([receipt, other], { ...EMPTY_RECEIPT_FILTERS, merchant: "tes" }).map((row) => row.id)).toEqual(["r2"]);
    expect(filterReceipts([receipt, other], { ...EMPTY_RECEIPT_FILTERS, amountMin: "40" }).map((row) => row.id)).toEqual(["r1"]);
    expect(filterReceipts([receipt, other], { ...EMPTY_RECEIPT_FILTERS, dateFrom: "2026-02-01" }).map((row) => row.id)).toEqual(["r2"]);
    expect(filterReceipts([receipt, other], { ...EMPTY_RECEIPT_FILTERS, attachmentType: "unattached" }).map((row) => row.id)).toEqual(["r2"]);
  });

  it("scores and searches attach targets", () => {
    const targets: AttachTarget[] = [
      { kind: "bill", id: "b1", title: "BP Garage", subtitle: "Fuel", amount: 48, date: "2026-01-21" },
      { kind: "invoice", id: "i1", title: "Hartley Studio", subtitle: "Design", amount: 900, date: "2026-01-10" },
    ];
    expect(scoreAttachTarget(receipt, targets[0])).toBeGreaterThan(0.9);
    expect(suggestAttachTargets(receipt, targets).map((row) => row.id)).toEqual(["b1"]);
    expect(
      scoreAttachTarget(receipt, { kind: "bank", id: "t-bp", title: "BP", subtitle: "BP CONNECT BRIGHTON", amount: 55, date: "2026-03-04" }),
    ).toBeGreaterThanOrEqual(0.4);
    expect(searchAttachTargets(targets, "design").map((row) => row.id)).toEqual(["i1"]);
  });

  it("dedupes attach targets that share merchant, amount and date", () => {
    const rows = dedupeAttachTargets([
      { kind: "bank", id: "a", title: "BP", subtitle: "BP CONNECT", amount: 55, date: "2026-03-04" },
      { kind: "bank", id: "b", title: "BP", subtitle: "BP CONNECT", amount: 55, date: "2026-03-04T00:00:00.000Z" },
    ]);
    expect(rows).toHaveLength(1);
  });

  it("derives an activity log when audit rows are missing", () => {
    const items = deriveReceiptActivity(receipt);
    expect(items.map((item) => item.action)).toEqual(["receipt.uploaded", "receipt.processed", "receipt.attached", "receipt.tagged"]);
    expect(activityLabel("receipt.attached")).toBe("Attached");
  });

  it("prefers matching audit rows", () => {
    const items = deriveReceiptActivity(receipt, [
      { id: "a1", actionType: "receipt.uploaded", createdAt: "2026-01-21T10:00:00.000Z", metadata: { receiptId: "r1" } },
      { id: "a2", actionType: "receipt.attached", createdAt: "2026-01-21T10:05:00.000Z", metadata: { receiptId: "r1" } },
    ]);
    expect(items[0].action).toBe("receipt.attached");
    expect(items).toHaveLength(2);
  });
});
