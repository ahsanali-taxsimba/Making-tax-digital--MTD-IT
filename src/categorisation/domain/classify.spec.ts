import { ChartProfile, TaxCodeKind } from "@prisma/client";
import { LedgerSnapshot, TaxCodeSnapshot } from "../../bookkeeping/domain/journal.rules";
import { classifyTransaction } from "./classify";
import { MCC_MAPPING } from "./mcc.mapping";
import { MERCHANT_DICTIONARY } from "./merchant.dictionary";
import { ClassifyContext } from "./types";

const ledger = (code: number, type: string, name: string): LedgerSnapshot => ({
  id: `L-${code}`,
  clientId: "c1",
  isActive: true,
  type,
  code,
  name,
  profile: ChartProfile.SOLE_TRADER,
  category: type === "INCOME" ? "Income" : type === "EXPENSE" ? "Expenses" : type === "ASSET" ? "Assets" : "VAT",
});

const ledgers = [
  ledger(1000, "INCOME", "Sales / Turnover"),
  ledger(1200, "ASSET", "Bank Current Account"),
  ledger(2200, "LIABILITY", "VAT on Sales"),
  ledger(2220, "LIABILITY", "VAT on Purchases"),
  ledger(3000, "EXPENSE", "Advertising & Marketing"),
  ledger(3010, "EXPENSE", "Bank Charges"),
  ledger(3050, "EXPENSE", "Office Supplies"),
  ledger(3080, "EXPENSE", "Motor Expenses"),
  ledger(3090, "EXPENSE", "Travel & Subsistence"),
  ledger(3150, "EXPENSE", "Subscriptions"),
];

const taxCodes: TaxCodeSnapshot[] = [
  { id: "S", code: "S", name: "Standard VAT 20%", rate: 20, type: TaxCodeKind.VAT_STANDARD },
  { id: "NA", code: "NA", name: "No VAT", rate: 0, type: TaxCodeKind.NO_VAT },
];

const context: ClassifyContext = {
  profile: ChartProfile.SOLE_TRADER,
  ledgers,
  taxCodes,
  merchantRules: MERCHANT_DICTIONARY,
  mccRules: MCC_MAPPING,
};

describe("classifyTransaction", () => {
  it("classifies BP as motor expenses with standard VAT and an ITSA motor category", () => {
    const result = classifyTransaction(
      {
        date: "2026-03-04",
        amount: 55,
        type: "DEBIT",
        description: "BP CONNECT BRIGHTON",
        merchantName: "BP",
        merchantCategoryCode: "5541",
      },
      context,
    );
    expect(result.ledgerCode).toBe(3080);
    expect(result.taxCode).toBe("S");
    expect(result.taxCodeKind).toBe(TaxCodeKind.VAT_STANDARD);
    expect(result.itsaCategory).toBe("Motor Expenses");
    expect(result.vatBoxes).toEqual(expect.arrayContaining(["box_7"]));
    expect(result.confidence).toBeGreaterThan(0.9);
    expect(result.reasons.some((reason) => reason.startsWith("merchant_dictionary"))).toBe(true);
    expect(result.reasons.some((reason) => reason.includes("recurring_subscription"))).toBe(false);
    expect(result.draftJournal.lines.some((line) => line.ledgerCode === 3080)).toBe(true);
  });

  it("classifies Tesco as office groceries", () => {
    const result = classifyTransaction(
      {
        date: "2026-03-06",
        amount: 23.4,
        type: "DEBIT",
        description: "TESCO STORES 2847",
        merchantName: "Tesco",
        merchantCategoryCode: "5411",
      },
      context,
    );
    expect(result.ledgerCode).toBe(3050);
    expect(result.itsaCategory).toBe("Office Costs");
    expect(result.taxCodeKind).toBe(TaxCodeKind.VAT_STANDARD);
  });

  it("classifies MCC 5812 as restaurants / subsistence", () => {
    const result = classifyTransaction(
      {
        date: "2026-03-08",
        amount: 48,
        type: "DEBIT",
        description: "THE LANE RESTAURANT",
        merchantName: "The Lane Restaurant",
        merchantCategoryCode: "5812",
      },
      context,
    );
    expect(result.ledgerCode).toBe(3090);
    expect(result.reasons.some((reason) => reason.startsWith("mcc:5812"))).toBe(true);
    expect(result.taxCodeKind).toBe(TaxCodeKind.VAT_STANDARD);
  });

  it("treats recurring Adobe charges as subscriptions", () => {
    const result = classifyTransaction(
      {
        date: "2026-03-01",
        amount: 12.99,
        type: "DEBIT",
        description: "ADOBE CREATIVE CLOUD MONTHLY",
        merchantName: "Adobe",
      },
      { ...context, siblings: [{ merchantName: "Adobe", amount: 12.99, description: "ADOBE CREATIVE CLOUD MONTHLY" }] },
    );
    expect(result.ledgerCode).toBe(3150);
    expect(result.itsaCategory).toBe("Subscriptions");
  });

  it("falls back to default expense with low confidence", () => {
    const result = classifyTransaction(
      { date: "2026-03-20", amount: 9.5, type: "DEBIT", description: "Mystery card payment" },
      context,
    );
    expect(result.ledgerCode).toBe(3000);
    expect(result.confidence).toBeLessThanOrEqual(0.45);
    expect(result.reasons.some((reason) => reason.startsWith("fallback"))).toBe(true);
  });

  it("classifies a thin bank line from receipt OCR text and VAT", () => {
    const result = classifyTransaction(
      {
        date: "2026-03-08",
        amount: 48,
        type: "DEBIT",
        description: "CARD PAYMENT",
        ocrText: "The Lane Restaurant\nVAT @ 20% £8.00\nTotal £48.00",
        ocrMerchantName: "The Lane Restaurant",
        ocrAmount: 48,
        ocrNetAmount: 40,
        ocrVatAmount: 8,
        ocrVatRate: 20,
      },
      context,
    );
    expect(result.ledgerCode).toBe(3090);
    expect(result.taxCodeKind).toBe(TaxCodeKind.VAT_STANDARD);
    expect(result.reasons.some((reason) => reason.startsWith("naive_bayes") || reason.startsWith("ocr_merchant"))).toBe(true);
    expect(result.confidenceBreakdown.ocrMatch).toBeGreaterThan(0.4);
    expect(result.model?.categoryKey).toBe("restaurants");
    expect(result.draftJournal.lines.some((line) => line.debit === 8 || line.credit === 8)).toBe(true);
  });

  it("matches an invoice description on a credit to sales", () => {
    const result = classifyTransaction(
      {
        date: "2026-01-15",
        amount: 7200,
        type: "CREDIT",
        description: "Brighton Gallery Ltd INV-1001",
        merchantName: "Brighton Gallery Ltd",
      },
      context,
    );
    expect(result.ledgerCode).toBe(1000);
    expect(result.itsaCategory).toBe("Turnover");
    expect(result.taxCodeKind).toBe(TaxCodeKind.VAT_STANDARD);
  });
});
