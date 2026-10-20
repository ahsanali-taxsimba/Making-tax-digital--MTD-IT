import { ReceiptsService } from "./receipts.service";
import { OCRService } from "./ocr.service";
import { InvoiceDetectionService } from "./ocr/invoice-detection.service";
import { MerchantDetectionService } from "./ocr/merchant-detection.service";
import { OCRParserService } from "./ocr/ocr-parser.service";
import { VATDetectionService } from "./ocr/vat-detection.service";

function ocr() {
  const parser = new OCRParserService();
  return new OCRService(parser, new MerchantDetectionService(parser), new VATDetectionService(parser), new InvoiceDetectionService());
}

describe("receipt pipeline integration", () => {
  it("uploads, OCRs, attaches, and exposes proof for VAT and ITSA", async () => {
    const order: string[] = [];
    const repo = {
      create: jest.fn().mockImplementation(async () => {
        order.push("store");
        return { id: "r1", clientId: "c1", fileName: "bp.pdf", fileType: "pdf", fileSize: 10, storageUrl: "/x", uploadedByUserId: "u1", uploadedAt: new Date(), tags: [], status: "UPLOADED" };
      }),
      markProcessed: jest.fn().mockImplementation(async () => {
        order.push("ocr");
        return { id: "r1", clientId: "c1", fileName: "bp.pdf", fileType: "pdf", fileSize: 10, storageUrl: "/x", uploadedByUserId: "u1", uploadedAt: new Date(), tags: [], ocrMerchant: "BP", ocrAmount: 48, status: "PROCESSED" };
      }),
      find: jest.fn().mockResolvedValue({
        id: "r1",
        clientId: "c1",
        bankTransactionId: "t1",
        fileName: "bp.pdf",
        fileType: "pdf",
        fileSize: 10,
        storageUrl: "/x",
        uploadedByUserId: "u1",
        uploadedAt: new Date(),
        tags: [],
        ocrMerchant: "BP",
        ocrAmount: 48,
        status: "PROCESSED",
      }),
      evidence: jest.fn().mockResolvedValue({
        receipts: [{ id: "r1", journalEntryId: "j1", billId: null, bankTransactionId: "t1", invoiceId: null }],
        bills: [],
        journals: [{ id: "j1", source: "BANK_FEED", lines: [{ debit: 48, credit: 0, ledger: { type: "EXPENSE", code: 3080 } }] }],
      }),
    };
    const attachments = {
      attachToBankTransaction: jest.fn().mockImplementation(async () => {
        order.push("attach");
        return { id: "r1", clientId: "c1", bankTransactionId: "t1", fileName: "bp.pdf", fileType: "pdf", fileSize: 10, storageUrl: "/x", uploadedByUserId: "u1", uploadedAt: new Date(), tags: [], status: "PROCESSED" };
      }),
    };
    const storage = {
      put: jest.fn().mockImplementation(async (key: string) => {
        order.push("disk");
        return key;
      }),
    };
    const service = new ReceiptsService(
      repo as never,
      { get: jest.fn().mockResolvedValue({ id: "c1", firmId: "f1" }) } as never,
      ocr(),
      attachments as never,
      { record: jest.fn() } as never,
      storage as never,
    );

    const uploaded = await service.upload({ id: "u1" } as never, {
      clientId: "c1",
      fileName: "bp.pdf",
      content: Buffer.from("%PDF-1.4 (BP) (Total £48.00)").toString("base64"),
      bankTransactionId: "t1",
    });
    const evidence = await service.evidenceForClient("c1");

    expect(order).toEqual(["disk", "store", "ocr", "attach"]);
    expect(uploaded.ocrMerchant).toBe("BP");
    expect(evidence.vat.box4.proofAttached).toBe(true);
    expect(evidence.itsa.attached).toBe(1);
  });
});
