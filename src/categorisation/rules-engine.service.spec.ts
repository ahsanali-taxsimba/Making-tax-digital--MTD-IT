import { ChartProfile } from "@prisma/client";
import { MCC_MAPPING } from "./domain/mcc.mapping";
import { MERCHANT_DICTIONARY } from "./domain/merchant.dictionary";
import { ITSAInferenceService } from "./itsa-inference.service";
import { RulesEngineService } from "./rules-engine.service";
import { VATInferenceService } from "./vat-inference.service";

describe("RulesEngineService", () => {
  const merchants = { list: jest.fn(), lookup: jest.fn() };
  const mcc = { list: jest.fn(), lookup: jest.fn() };
  const engine = new RulesEngineService(merchants as never, mcc as never, new VATInferenceService(), new ITSAInferenceService());

  beforeEach(() => {
    jest.clearAllMocks();
    merchants.list.mockResolvedValue(MERCHANT_DICTIONARY);
    mcc.list.mockResolvedValue(MCC_MAPPING);
    merchants.lookup.mockImplementation(async (name: string, description: string) =>
      MERCHANT_DICTIONARY.find((rule) => `${name} ${description}`.toLowerCase().includes(rule.merchantKey)) ?? null,
    );
    mcc.lookup.mockImplementation(async (code: string) => MCC_MAPPING.find((rule) => rule.mcc === code) ?? null);
  });

  it("evaluates merchant, MCC, VAT and ITSA together", async () => {
    const result = await engine.evaluate(
      { date: "2026-03-04", amount: 55, type: "DEBIT", description: "BP CONNECT", merchantName: "BP", merchantCategoryCode: "5541" },
      ChartProfile.SOLE_TRADER,
    );
    expect(result.merchant?.merchantName).toBe("BP");
    expect(result.mcc?.mcc).toBe("5541");
    expect(result.taxCode).toBe("S");
    expect(result.itsa?.category).toBe("Motor Expenses");
  });

  it("lists merchant, MCC, VAT, ITSA and amount-pattern rules", async () => {
    const catalog = await engine.catalog();
    expect(catalog.merchants.some((rule) => rule.merchantName === "BP")).toBe(true);
    expect(catalog.vat.rates).toEqual([0, 5, 20]);
    expect(catalog.itsa.some((row) => row.category === "Motor Expenses")).toBe(true);
    expect(catalog.amountPatterns).toContain("recurring_subscription");
  });
});
