import { extractInvoiceFromText } from "./domain/extract";
import { InvoiceExtractionService } from "./invoice-extraction.service";

/**
 * Parser + confirm path without a live database: OCR text in, draft bill payload out.
 */
describe("invoice extraction integration", () => {
  const SAMPLE = `
    North Ads Agency Ltd
    12 Ship Street Brighton BN1 1AE
    Invoice No INV-4412
    Invoice Date 21 January 2026
    Due Date 4 February 2026
    Design work 1 400.00 400.00 80.00 480.00
    Hosting 2 12.00 24.00 4.80 28.80
    Subtotal £424.00
    VAT 20% £84.80
    Total £508.80
  `;

  it("parses a UK supplier invoice and maps VAT box 4 / ITSA expense", () => {
    const extracted = extractInvoiceFromText(SAMPLE);
    expect(extracted.invoiceNumber).toBe("INV-4412");
    expect(extracted.lineItems).toHaveLength(2);
    expect(extracted.subtotal).toBe(424);
    expect(extracted.vatTotal).toBe(84.8);
    expect(extracted.grandTotal).toBe(508.8);
    expect(extracted.vatBoxes).toEqual(expect.arrayContaining(["box_4"]));
    expect(extracted.issues).toEqual([]);
  });

  it("runs OCR when stored text is missing then confirms a draft sales invoice", async () => {
    const repo = {
      findDocument: jest.fn().mockResolvedValue({
        id: "doc-1",
        clientId: "c1",
        type: "INVOICE",
        fileType: "pdf",
        fileName: "sales.pdf",
        storageKey: "key",
        ocrText: null,
        extractedData: null,
        invoiceId: null,
        billId: null,
      }),
      markStatus: jest.fn(),
      writeExtraction: jest.fn().mockResolvedValue({}),
      log: jest.fn(),
      attachInvoice: jest.fn(),
      attachBill: jest.fn(),
    };
    const books = {
      listParties: jest.fn().mockResolvedValue([]),
      listTaxCodes: jest.fn().mockResolvedValue([{ id: "S", type: "VAT_STANDARD" }]),
      findPartyByName: jest.fn().mockResolvedValue(null),
      ensureParty: jest.fn().mockResolvedValue({ id: "cust-1", name: "Brighton Gallery Ltd" }),
      createInvoice: jest.fn().mockResolvedValue({ id: "inv-1", status: "DRAFT" }),
      createBill: jest.fn(),
      toDate: (value: string) => new Date(`${value}T00:00:00.000Z`),
    };
    const ocr = { extract: jest.fn().mockResolvedValue({ text: "Sales invoice\nBrighton Gallery Ltd\nInvoice No INV-1001\nDate 15/01/2026\nTotal £7200.00" }) };
    const storage = { get: jest.fn().mockResolvedValue(Buffer.from("%PDF")) };
    const service = new InvoiceExtractionService(
      repo as never,
      { get: jest.fn().mockResolvedValue({ id: "c1", firmId: "f1", type: "INDIVIDUAL" }) } as never,
      books as never,
      ocr as never,
      storage as never,
      { record: jest.fn() } as never,
    );
    const actor = { id: "u1", role: "ADMIN", firmId: "f1", clientId: null } as never;
    const extracted = await service.extractFromDocument(actor, "doc-1", "sales");
    expect(storage.get).toHaveBeenCalled();
    expect(ocr.extract).toHaveBeenCalled();
    expect(extracted.extracted.invoiceNumber).toBe("INV-1001");
    repo.findDocument.mockResolvedValue({
      id: "doc-1",
      clientId: "c1",
      type: "INVOICE",
      invoiceId: null,
      billId: null,
      extractedData: extracted.extracted,
    });
    const confirmed = await service.confirm(actor, "doc-1", { direction: "sales" });
    expect(books.createInvoice).toHaveBeenCalledWith(expect.objectContaining({ status: "DRAFT" }));
    expect(confirmed.status).toBe("draft_extracted");
    expect(confirmed.invoice?.id).toBe("inv-1");
  });
});
