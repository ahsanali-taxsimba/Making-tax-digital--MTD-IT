import { DocumentStatus } from "@prisma/client";
import { BK_ERR } from "./bookkeeping.errors";
import { InvoiceService } from "./invoice.service";

describe("InvoiceService draft posting", () => {
  const repo = {
    findInvoice: jest.fn(),
    findBill: jest.fn(),
    listLedgers: jest.fn(),
    listTaxCodes: jest.fn(),
    listPeriods: jest.fn(),
    updateInvoiceJournal: jest.fn(),
    updateBillJournal: jest.fn(),
    toDate: jest.fn((value: string) => new Date(`${value}T00:00:00.000Z`)),
  };
  const clients = { get: jest.fn() };
  const journals = { post: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new InvoiceService(repo as never, clients as never, journals as never, audit as never);
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null } as never;
  const ledgers = [
    { id: "inc", code: 1000, name: "Sales", profile: "SOLE_TRADER" },
    { id: "deb", code: 1100, name: "Debtors", profile: "SOLE_TRADER" },
    { id: "vat", code: 2200, name: "Output VAT", profile: "SOLE_TRADER" },
    { id: "exp", code: 3000, name: "Expenses", profile: "SOLE_TRADER" },
    { id: "cred", code: 2100, name: "Creditors", profile: "SOLE_TRADER" },
    { id: "ivat", code: 2220, name: "Input VAT", profile: "SOLE_TRADER" },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1", type: "INDIVIDUAL" });
    repo.listLedgers.mockResolvedValue(ledgers);
    repo.listTaxCodes.mockResolvedValue([{ id: "S", type: "VAT_STANDARD", rate: 20 }]);
    repo.listPeriods.mockResolvedValue([]);
    journals.post.mockResolvedValue({ id: "j1", source: "INVOICE" });
    repo.updateInvoiceJournal.mockResolvedValue({ id: "inv-1", status: DocumentStatus.POSTED, journalId: "j1" });
    repo.updateBillJournal.mockResolvedValue({ id: "bill-1", status: DocumentStatus.POSTED, journalId: "j1" });
  });

  it("returns a draft invoice ready to post", async () => {
    repo.findInvoice.mockResolvedValue({
      id: "inv-1",
      clientId: "c1",
      date: new Date("2026-01-21"),
      dueDate: new Date("2026-02-04"),
      status: DocumentStatus.DRAFT,
      invoiceNumber: "INV-4412",
      netTotal: 400,
      vatTotal: 80,
      grossTotal: 480,
      journalId: null,
      customer: { id: "p1", name: "North Ads Agency Ltd" },
      lines: [{ id: "l1", description: "Design", net: 400, vat: 80 }],
      documents: [],
      receipts: [],
    });
    const invoice = await service.getInvoice(actor, "inv-1");
    expect(invoice.readyToPost).toBe(true);
    expect(invoice.partyName).toBe("North Ads Agency Ltd");
    expect(invoice.grossTotal).toBe(480);
  });

  it("previews a balanced sales journal without posting", async () => {
    repo.findInvoice.mockResolvedValue({
      id: "inv-1",
      clientId: "c1",
      date: new Date("2026-01-21"),
      invoiceNumber: "INV-4412",
      customer: { name: "North Ads Agency Ltd" },
      lines: [{ description: "Design", net: 400, vat: 80 }],
    });
    const preview = await service.journalPreviewForInvoice(actor, "inv-1");
    expect(preview.kind).toBe("sales");
    expect(preview.grossTotal).toBe(480);
    expect(preview.lines.some((line) => line.accountName === "Debtors")).toBe(true);
    expect(journals.post).not.toHaveBeenCalled();
  });

  it("posts a draft invoice to the ledger", async () => {
    repo.findInvoice.mockResolvedValue({
      id: "inv-1",
      clientId: "c1",
      date: new Date("2026-01-21"),
      dueDate: new Date("2026-02-04"),
      status: DocumentStatus.DRAFT,
      invoiceNumber: "INV-4412",
      netTotal: 400,
      vatTotal: 80,
      grossTotal: 480,
      journalId: null,
      customer: { id: "p1", name: "North Ads Agency Ltd" },
      lines: [{ id: "l1", description: "Design", net: 400, vat: 80 }],
    });
    const posted = await service.postDraftInvoice(actor, "inv-1");
    expect(journals.post).toHaveBeenCalled();
    expect(repo.updateInvoiceJournal).toHaveBeenCalledWith("inv-1", "j1");
    expect(posted.journal.id).toBe("j1");
  });

  it("refuses to post an invoice that is already on the ledger", async () => {
    repo.findInvoice.mockResolvedValue({
      id: "inv-1",
      clientId: "c1",
      status: DocumentStatus.POSTED,
      journalId: "j1",
    });
    await expect(service.postDraftInvoice(actor, "inv-1")).rejects.toMatchObject({ code: BK_ERR.ALREADY_POSTED });
  });
});
