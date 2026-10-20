import { DOC_ERR } from "./documents.errors";
import { DocumentAttachmentService } from "./document-attachment.service";

describe("DocumentAttachmentService", () => {
  const repo = {
    find: jest.fn(),
    update: jest.fn(),
    findBankTransaction: jest.fn(),
    findInvoice: jest.fn(),
    findVatReturn: jest.fn(),
    findItsaSubmission: jest.fn(),
  };
  const clients = { get: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new DocumentAttachmentService(repo as never, clients as never, audit as never);
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null } as never;
  const document = {
    id: "d1",
    clientId: "c1",
    bankTransactionId: null,
    invoiceId: null,
    billId: null,
    journalEntryId: null,
    vatReturnId: null,
    itsaSubmissionId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1" });
    repo.find.mockResolvedValue(document);
    repo.update.mockImplementation(async (_id: string, data: Record<string, unknown>) => ({ ...document, ...flattenConnect(data) }));
  });

  it("attaches a document to a bank transaction, VAT return and ITSA submission", async () => {
    repo.findBankTransaction.mockResolvedValue({ id: "t1", bankAccount: { clientId: "c1" } });
    repo.findVatReturn.mockResolvedValue({ id: "v1", clientId: "c1" });
    repo.findItsaSubmission.mockResolvedValue({ id: "i1", clientId: "c1" });
    const saved = await service.attach(actor, "d1", { bankTransactionId: "t1", vatReturnId: "v1", itsaSubmissionId: "i1" });
    expect(saved.attachedTo).toMatchObject({
      clientId: "c1",
      bankTransactionId: "t1",
      vatReturnId: "v1",
      itsaSubmissionId: "i1",
    });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "document.attached" }));
  });

  it("refuses a bank line from another client", async () => {
    repo.findBankTransaction.mockResolvedValue({ id: "t1", bankAccount: { clientId: "other" } });
    await expect(service.attach(actor, "d1", { bankTransactionId: "t1" })).rejects.toMatchObject({ errorCode: DOC_ERR.TARGET_NOT_FOUND });
  });

  it("detaches all bookkeeping links and keeps the client attachment", async () => {
    repo.find.mockResolvedValue({ ...document, bankTransactionId: "t1", vatReturnId: "v1" });
    const saved = await service.detach(actor, "d1", "all");
    expect(saved.attachedTo).toMatchObject({ clientId: "c1", bankTransactionId: null, vatReturnId: null });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "document.detached" }));
  });
});

function flattenConnect(data: Record<string, unknown>) {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "connect" in value) {
      const connected = (value as { connect?: { id?: string } }).connect;
      if (key === "bankTransaction") next.bankTransactionId = connected?.id;
      if (key === "vatReturn") next.vatReturnId = connected?.id;
      if (key === "itsaSubmission") next.itsaSubmissionId = connected?.id;
      if (key === "invoice") next.invoiceId = connected?.id;
    }
    if (value && typeof value === "object" && "disconnect" in value) {
      if (key === "bankTransaction") next.bankTransactionId = null;
      if (key === "vatReturn") next.vatReturnId = null;
      if (key === "itsaSubmission") next.itsaSubmissionId = null;
    }
    if (key === "attachedTo") {
      next.attachedTo = value;
    }
  }
  return next;
}
