import { ReceiptsService } from "./receipts.service";
import { OCRService } from "./ocr.service";
import { RECEIPT_ERR } from "./receipts.errors";

describe("ReceiptsService", () => {
  const repo = {
    create: jest.fn(),
    find: jest.fn(),
    list: jest.fn(),
    markProcessed: jest.fn(),
    ensureTags: jest.fn(),
    setTagLinks: jest.fn(),
    listTags: jest.fn(),
    evidence: jest.fn(),
    findBankTransaction: jest.fn(),
    listClientBankTransactions: jest.fn(),
  };
  const clients = { get: jest.fn() };
  const attachments = {
    attachToBankTransaction: jest.fn(),
    attachToInvoice: jest.fn(),
    attachToBill: jest.fn(),
    attachToJournal: jest.fn(),
  };
  const audit = { record: jest.fn() };
  const storage = { put: jest.fn(), get: jest.fn(), remove: jest.fn() };
  const service = new ReceiptsService(
    repo as never,
    clients as never,
    new OCRService(),
    attachments as never,
    audit as never,
    storage as never,
  );
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null } as never;
  const pdf = Buffer.from("%PDF-1.4 (BP Fuel) (Total £48.00) (21/01/2026)").toString("base64");

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1" });
    storage.put.mockResolvedValue("/receipts/file/key");
    repo.create.mockResolvedValue({
      id: "r1",
      clientId: "c1",
      fileName: "bp.pdf",
      fileType: "pdf",
      fileSize: 20,
      storageUrl: "/receipts/file/key",
      uploadedByUserId: "u1",
      uploadedAt: new Date(),
      tags: ["Fuel"],
      status: "UPLOADED",
    });
    repo.markProcessed.mockImplementation(async (id: string, ocr: { merchantName: string }) => ({
      id,
      clientId: "c1",
      fileName: "bp.pdf",
      fileType: "pdf",
      fileSize: 20,
      storageUrl: "/receipts/file/key",
      uploadedByUserId: "u1",
      uploadedAt: new Date(),
      tags: ["Fuel"],
      ocrMerchant: ocr.merchantName,
      ocrAmount: 48,
      ocrDate: new Date("2026-01-21"),
      ocrText: "BP Fuel",
      status: "PROCESSED",
    }));
    repo.ensureTags.mockResolvedValue([{ id: "tag-fuel", name: "Fuel" }]);
    attachments.attachToBankTransaction.mockResolvedValue({
      id: "r1",
      clientId: "c1",
      bankTransactionId: "t1",
      fileName: "bp.pdf",
      fileType: "pdf",
      fileSize: 20,
      storageUrl: "/x",
      uploadedByUserId: "u1",
      uploadedAt: new Date(),
      tags: [],
      status: "PROCESSED",
    });
    repo.find.mockResolvedValue({
      id: "r1",
      clientId: "c1",
      bankTransactionId: "t1",
      fileName: "bp.pdf",
      fileType: "pdf",
      fileSize: 20,
      storageUrl: "/receipts/file/key",
      uploadedByUserId: "u1",
      uploadedAt: new Date(),
      tags: ["Fuel"],
      ocrMerchant: "BP",
      ocrAmount: 48,
      ocrDate: new Date("2026-01-21"),
      ocrText: "BP Fuel",
      status: "PROCESSED",
    });
  });

  it("rejects unsupported file types", async () => {
    await expect(
      service.upload(actor, { clientId: "c1", fileName: "notes.docx", content: Buffer.from("x").toString("base64") }),
    ).rejects.toMatchObject({ errorCode: RECEIPT_ERR.FILE_TYPE });
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("stores a PDF, runs OCR, and attaches to a bank line", async () => {
    const result = await service.upload(actor, {
      clientId: "c1",
      fileName: "bp.pdf",
      content: pdf,
      tags: ["Fuel"],
      bankTransactionId: "t1",
    });
    expect(storage.put).toHaveBeenCalledWith(
      expect.stringMatching(/^clients\/c1\/receipts\/.+\/file\.pdf$/),
      expect.any(Buffer),
      "application/pdf",
    );
    expect(result.status).toBe("processed");
    expect(result.ocrMerchant).toBe("BP");
    expect(attachments.attachToBankTransaction).toHaveBeenCalledWith(actor, "r1", "t1");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "receipt.uploaded" }));
  });

  it("builds VAT Box 4 and ITSA receipt evidence", async () => {
    repo.evidence.mockResolvedValue({
      receipts: [{ id: "r1", journalEntryId: "j1", billId: "b1", bankTransactionId: null, invoiceId: null }],
      bills: [{ id: "b1", journalId: "j1", vatTotal: 8 }],
      journals: [
        { id: "j1", source: "BILL", lines: [{ debit: 40, credit: 0, ledger: { type: "EXPENSE", code: 3080 } }] },
        { id: "j2", source: "MANUAL", lines: [{ debit: 0, credit: 100, ledger: { type: "INCOME", code: 1000 } }] },
      ],
    });
    const evidence = await service.evidence(actor, { clientId: "c1" });
    expect(evidence.vat.box4.proofAttached).toBe(true);
    expect(evidence.vat.box4.withProof).toBeGreaterThan(0);
    expect(evidence.itsa.allowableExpensesWithReceipt).toBe(1);
    expect(evidence.receiptsAttached).toBe(1);
  });
});
