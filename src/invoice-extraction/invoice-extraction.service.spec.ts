import { DocumentKind, ExtractionStatus } from "@prisma/client";
import { EXTRACT_ERR } from "./invoice-extraction.errors";
import { InvoiceExtractionService } from "./invoice-extraction.service";

const SAMPLE = `
North Ads Agency Ltd
12 Ship Street Brighton BN1 1AE
Invoice No: INV-4412
Invoice Date: 21/01/2026
Due Date: 04/02/2026
Design work 1 400.00 400.00 80.00 480.00
Subtotal £400.00
VAT 20% £80.00
Total £480.00
`;

describe("InvoiceExtractionService", () => {
  const repo = {
    findDocument: jest.fn(),
    markStatus: jest.fn(),
    writeExtraction: jest.fn(),
    log: jest.fn(),
    attachBill: jest.fn(),
    attachInvoice: jest.fn(),
    listForClient: jest.fn(),
    listLogs: jest.fn(),
    listSupporting: jest.fn(),
    attachManyToInvoice: jest.fn(),
    attachManyToBill: jest.fn(),
    listAudit: jest.fn(),
  };
  const clients = { get: jest.fn() };
  const books = {
    listParties: jest.fn(),
    listTaxCodes: jest.fn(),
    findPartyByName: jest.fn(),
    ensureParty: jest.fn(),
    createBill: jest.fn(),
    createInvoice: jest.fn(),
    toDate: jest.fn((value: string) => new Date(`${value}T00:00:00.000Z`)),
  };
  const ocr = { extract: jest.fn() };
  const storage = { get: jest.fn() };
  const audit = { record: jest.fn() };
  const service = new InvoiceExtractionService(
    repo as never,
    clients as never,
    books as never,
    ocr as never,
    storage as never,
    audit as never,
  );
  const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null } as never;
  const document = {
    id: "doc-1",
    clientId: "c1",
    type: DocumentKind.INVOICE,
    fileType: "pdf",
    fileName: "inv.pdf",
    storageKey: "key",
    ocrText: SAMPLE,
    extractedData: null,
    extractionStatus: ExtractionStatus.NOT_STARTED,
    invoiceId: null,
    billId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    clients.get.mockResolvedValue({ id: "c1", firmId: "f1", type: "INDIVIDUAL" });
    repo.findDocument.mockResolvedValue(document);
    repo.writeExtraction.mockResolvedValue(document);
    repo.markStatus.mockResolvedValue(document);
    repo.listSupporting.mockResolvedValue([]);
    repo.listLogs.mockResolvedValue([]);
    repo.listAudit.mockResolvedValue([]);
    repo.listForClient.mockResolvedValue([]);
    repo.attachManyToInvoice.mockResolvedValue({ count: 0 });
    repo.attachManyToBill.mockResolvedValue({ count: 0 });
    books.listParties.mockResolvedValue([{ id: "p1", name: "North Ads Agency Ltd" }]);
    books.listTaxCodes.mockResolvedValue([{ id: "S", type: "VAT_STANDARD", rate: 20 }]);
    books.findPartyByName.mockResolvedValue({ id: "p1", name: "North Ads Agency Ltd" });
    books.createBill.mockResolvedValue({ id: "bill-1", status: "DRAFT", invoiceNumber: "INV-4412" });
  });

  it("extracts structured invoice data from document OCR", async () => {
    const result = await service.extractFromDocument(actor, "doc-1");
    expect(result.status).toBe("completed");
    expect(result.extracted.invoiceNumber).toBe("INV-4412");
    expect(result.extracted.supplierId).toBe("p1");
    expect(result.extracted.grandTotal).toBe(480);
    expect(repo.writeExtraction).toHaveBeenCalled();
    expect(repo.log).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "invoice.extraction.completed" }));
  });

  it("confirms extraction into a draft bill without posting a journal", async () => {
    repo.findDocument.mockResolvedValue({
      ...document,
      extractedData: {
        supplierName: "North Ads Agency Ltd",
        supplierId: "p1",
        invoiceNumber: "INV-4412",
        invoiceDate: "2026-01-21",
        dueDate: "2026-02-04",
        direction: "purchase",
        lineItems: [{ description: "Design work", net: 400, vat: 80 }],
        subtotal: 400,
        vatTotal: 80,
        grandTotal: 480,
      },
    });
    const confirmed = await service.confirm(actor, "doc-1", {});
    expect(confirmed.status).toBe("draft_extracted");
    expect(books.createBill).toHaveBeenCalledWith(expect.objectContaining({ status: "DRAFT", invoiceNumber: "INV-4412" }));
    expect(repo.attachBill).toHaveBeenCalledWith("doc-1", "bill-1");
    expect(confirmed.bill?.id).toBe("bill-1");
  });

  it("refuses a second confirm", async () => {
    repo.findDocument.mockResolvedValue({ ...document, billId: "bill-1" });
    await expect(service.confirm(actor, "doc-1", {})).rejects.toMatchObject({ errorCode: EXTRACT_ERR.ALREADY_CONFIRMED });
  });

  it("returns a not-started extraction instead of 404", async () => {
    const result = await service.getExtraction(actor, "doc-1");
    expect(result.status).toBe("not_started");
    expect(result.reviewStatus).toBe("not_started");
    expect(result.extracted.invoiceNumber).toBeNull();
  });

  it("saves accountant corrections as a draft without creating a bill", async () => {
    repo.findDocument.mockResolvedValue({
      ...document,
      extractedData: { supplierName: "North Ads", invoiceNumber: "INV-4412", invoiceDate: "2026-01-21", lineItems: [], confidence: 0.8 },
    });
    const draft = await service.saveDraft(actor, "doc-1", { supplierName: "North Ads Agency Ltd", invoiceNumber: "INV-4412-A" });
    expect(books.createBill).not.toHaveBeenCalled();
    expect(repo.writeExtraction).toHaveBeenCalled();
    expect(draft.extracted.supplierName).toBe("North Ads Agency Ltd");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "invoice.extraction.draft_saved" }));
  });

  it("rejects an extraction that has not been confirmed", async () => {
    const rejected = await service.reject(actor, "doc-1", "Unreadable scan");
    expect(rejected.status).toBe("rejected");
    expect(repo.markStatus).toHaveBeenCalledWith("doc-1", "REJECTED");
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ actionType: "invoice.extraction.rejected" }));
  });

  it("reprocesses by running extraction again", async () => {
    const result = await service.reprocess(actor, "doc-1");
    expect(result.status).toBe("completed");
    expect(repo.writeExtraction).toHaveBeenCalled();
  });
});
