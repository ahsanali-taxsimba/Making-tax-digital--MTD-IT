import { CategorisationService } from "../../categorisation/categorisation.service";
import { OcrFeedService } from "./ocr-feed.service";

describe("OcrFeedService", () => {
  const repo = {
    findBankTransaction: jest.fn(),
    updateBankTransaction: jest.fn(),
  };
  const categorisation = { suggest: jest.fn() };
  const matching = { suggestions: jest.fn() };
  const moduleRef = {
    get: jest.fn((token: unknown) => (token === CategorisationService ? categorisation : matching)),
  };
  const feed = new OcrFeedService(repo as never, moduleRef as never);
  const extraction = {
    text: "BP",
    merchantName: "BP",
    supplierName: null,
    amount: 48,
    netAmount: 40,
    vatAmount: 8,
    vatRate: 20,
    date: "2026-01-21",
    invoiceNumber: "INV-4412",
    source: "pdf" as const,
    confidence: 0.9,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    repo.findBankTransaction.mockResolvedValue({ id: "t1", merchantName: null, enrichment: {} });
    categorisation.suggest.mockResolvedValue({ count: 1 });
    matching.suggestions.mockResolvedValue({ count: 1 });
  });

  it("copies OCR merchant and invoice number onto the bank line then refreshes engines", async () => {
    await feed.afterOcr({ id: "u1" } as never, { id: "r1", clientId: "c1", bankTransactionId: "t1" }, extraction);
    expect(repo.updateBankTransaction).toHaveBeenCalledWith(
      "t1",
      expect.objectContaining({
        merchantName: "BP",
        enrichment: expect.objectContaining({
          receiptOcr: expect.objectContaining({ invoiceNumber: "INV-4412", vatAmount: 8 }),
        }),
      }),
    );
    expect(categorisation.suggest).toHaveBeenCalledWith(expect.anything(), { bankTransactionId: "t1", persist: true });
    expect(matching.suggestions).toHaveBeenCalledWith(expect.anything(), { bankTransactionId: "t1", persist: true });
  });

  it("skips engine feed when the receipt is not attached to a bank line", async () => {
    await feed.afterOcr({ id: "u1" } as never, { id: "r1", clientId: "c1" }, extraction);
    expect(repo.updateBankTransaction).not.toHaveBeenCalled();
    expect(categorisation.suggest).not.toHaveBeenCalled();
  });
});
