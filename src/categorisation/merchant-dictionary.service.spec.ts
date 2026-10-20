import { TaxCodeKind } from "@prisma/client";
import { MerchantDictionaryService } from "./merchant-dictionary.service";

describe("MerchantDictionaryService", () => {
  const repo = { listMerchantRules: jest.fn() };
  const service = new MerchantDictionaryService(repo as never);

  it("falls back to the built-in dictionary when the table is empty", async () => {
    repo.listMerchantRules.mockResolvedValue([]);
    const hit = await service.lookup("BP", "BP CONNECT");
    expect(hit?.ledgerCode).toBe(3080);
    expect(hit?.taxCodeKind).toBe(TaxCodeKind.VAT_STANDARD);
  });

  it("prefers persisted merchant rules", async () => {
    repo.listMerchantRules.mockResolvedValue([
      {
        merchantKey: "bp",
        merchantName: "BP",
        aliases: [],
        categoryKey: "fuel",
        ledgerCode: 3080,
        taxCodeKind: TaxCodeKind.VAT_STANDARD,
        itsaCategory: "Motor Expenses",
        confidence: 0.99,
      },
    ]);
    const rules = await service.list();
    expect(rules[0].confidence).toBe(0.99);
  });
});
