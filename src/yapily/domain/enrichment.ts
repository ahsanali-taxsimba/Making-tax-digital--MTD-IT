export interface EnrichedBankLine {
  merchantName: string | null;
  category: string | null;
  transactionType: "CREDIT" | "DEBIT";
  vatHint: "STANDARD" | "NONE";
  itsaBucket: "income" | "expense" | "bank";
}

const MERCHANT_CATEGORIES: Array<{ match: RegExp; category: string; vat: "STANDARD" | "NONE" }> = [
  { match: /gallery|studio sales|receipts|invoice/i, category: "sales", vat: "STANDARD" },
  { match: /ads|advert|agency/i, category: "advertising", vat: "STANDARD" },
  { match: /fee|charge|interest/i, category: "bank_charges", vat: "NONE" },
  { match: /tesco|sainsbury|grocer/i, category: "office_costs", vat: "STANDARD" },
  { match: /bp |shell |fuel|petrol/i, category: "motor_expenses", vat: "STANDARD" },
  { match: /rent|letting/i, category: "property_income", vat: "NONE" },
];

export function enrichBankLine(input: {
  description: string;
  merchantName?: string | null;
  category?: string | null;
  type: "CREDIT" | "DEBIT";
  transactionType?: string | null;
}): EnrichedBankLine {
  const haystack = `${input.merchantName ?? ""} ${input.description} ${input.category ?? ""}`;
  const known = MERCHANT_CATEGORIES.find((rule) => rule.match.test(haystack));
  const merchantName = input.merchantName?.trim() || extractMerchant(input.description);
  const category = input.category?.trim() || known?.category || (input.type === "CREDIT" ? "income" : "expense");
  return {
    merchantName,
    category,
    transactionType: input.type,
    vatHint: known?.vat ?? (input.type === "CREDIT" ? "STANDARD" : "NONE"),
    itsaBucket: input.type === "CREDIT" ? "income" : "expense",
  };
}

export function extractMerchant(description: string): string | null {
  const cleaned = description.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }
  const withoutRef = cleaned.replace(/\b(INV|BILL|REF)[- ]?\w+/gi, "").trim();
  return withoutRef || cleaned;
}
