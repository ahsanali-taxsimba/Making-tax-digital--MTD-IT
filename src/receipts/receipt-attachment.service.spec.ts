import { ReceiptAttachmentService } from "./receipt-attachment.service";
import { RECEIPT_ERR } from "./receipts.errors";

describe("ReceiptAttachmentService", () => {
  const repo = {
    find: jest.fn(),
    update: jest.fn(),
    findBankTransaction: jest.fn(),
    findInvoice: jest.fn(),
    findBill: jest.fn(),
    findJournal: jest.fn(),
    updateBankTransaction: jest.fn(),
  };
  const clients = { get: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new ReceiptAttachmentService(repo as never, clients as never, audit as never);
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null } as never;

  beforeEach(() => {
    jest.clearAllMocks();
    repo.find.mockResolvedValue({
      id: "r1",
      clientId: "c1",
      ocrMerchant: "BP",
      ocrAmount: 48,
      ocrDate: new Date("2026-01-21"),
    });
    clients.get.mockResolvedValue({ id: "c1" });
    repo.update.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ id: "r1", clientId: "c1", ...data }));
  });

  it("attaches to a bank transaction and copies OCR merchant when missing", async () => {
    repo.findBankTransaction.mockResolvedValue({
      id: "t1",
      merchantName: null,
      bankAccount: { clientId: "c1" },
      enrichment: {},
    });
    await service.attachToBankTransaction(actor, "r1", "t1");
    expect(repo.updateBankTransaction).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({ merchantName: "BP" }),
    );
    expect(repo.update).toHaveBeenCalledWith("r1", expect.objectContaining({ bankTransaction: { connect: { id: "t1" } } }));
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "receipt.attached" }));
  });

  it("attaches to invoices, bills and journals in the same client", async () => {
    repo.findInvoice.mockResolvedValue({ id: "inv1", clientId: "c1" });
    repo.findBill.mockResolvedValue({ id: "bill1", clientId: "c1" });
    repo.findJournal.mockResolvedValue({ id: "j1", clientId: "c1" });
    await service.attachToInvoice(actor, "r1", "inv1");
    await service.attachToBill(actor, "r1", "bill1");
    await service.attachToJournal(actor, "r1", "j1");
    expect(repo.update).toHaveBeenCalledTimes(3);
  });

  it("rejects a target from another client", async () => {
    repo.findInvoice.mockResolvedValue({ id: "inv1", clientId: "other" });
    await expect(service.attachToInvoice(actor, "r1", "inv1")).rejects.toMatchObject({
      errorCode: RECEIPT_ERR.TARGET_NOT_FOUND,
    });
  });

  it("detaches from every record", async () => {
    await service.detach(actor, "r1");
    expect(repo.update).toHaveBeenCalledWith(
      "r1",
      expect.objectContaining({
        bankTransaction: { disconnect: true },
        invoice: { disconnect: true },
        bill: { disconnect: true },
        journal: { disconnect: true },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "receipt.detached" }));
  });
});
