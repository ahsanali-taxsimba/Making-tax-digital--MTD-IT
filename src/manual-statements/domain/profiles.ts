export type CsvColumnRole = "date" | "description" | "amount" | "debit" | "credit" | "balance" | "type" | "reference";

export interface CsvFormatProfile {
  id: "HSBC" | "BARCLAYS" | "NATWEST" | "SANTANDER" | "GENERIC";
  name: string;
  bank: string;
  headers: Partial<Record<CsvColumnRole, string[]>>;
  notes: string;
}

export const CSV_FORMAT_PROFILES: CsvFormatProfile[] = [
  {
    id: "HSBC",
    name: "HSBC UK",
    bank: "HSBC",
    headers: {
      date: ["date"],
      type: ["type"],
      description: ["details"],
      debit: ["paidout"],
      credit: ["paidin"],
      balance: ["balance"],
    },
    notes: "Date, Type, Details, Paid out, Paid in, Balance",
  },
  {
    id: "BARCLAYS",
    name: "Barclays",
    bank: "Barclays",
    headers: {
      date: ["date"],
      description: ["memo", "subcategory"],
      amount: ["amount"],
      reference: ["number"],
    },
    notes: "Date, Memo, Amount (signed) — optional Number / Subcategory",
  },
  {
    id: "NATWEST",
    name: "NatWest",
    bank: "NatWest",
    headers: {
      date: ["date"],
      type: ["type"],
      description: ["description"],
      amount: ["value"],
      balance: ["balance"],
    },
    notes: "Date, Type, Description, Value, Balance",
  },
  {
    id: "SANTANDER",
    name: "Santander",
    bank: "Santander",
    headers: {
      date: ["date"],
      description: ["description"],
      credit: ["moneyin"],
      debit: ["moneyout"],
      balance: ["balance"],
    },
    notes: "Date, Description, Money in, Money out, Balance",
  },
  {
    id: "GENERIC",
    name: "Generic UK CSV",
    bank: "Generic",
    headers: {
      date: ["date", "transactiondate", "valuedate"],
      description: ["description", "narrative", "memo", "details"],
      amount: ["amount"],
      debit: ["debit"],
      credit: ["credit"],
      balance: ["balance"],
      type: ["type", "direction"],
    },
    notes: "date + amount, or date + debit/credit columns",
  },
];

const GENERIC_ALIASES: Record<CsvColumnRole, string[]> = {
  date: ["date", "transactiondate", "posted", "valuedate", "trandate", "bookingdate"],
  description: [
    "description",
    "details",
    "narrative",
    "memo",
    "particulars",
    "transactiondescription",
    "name",
    "merchant",
    "payee",
  ],
  amount: ["amount", "value", "transactionamount", "gbp"],
  debit: ["debit", "paidout", "moneyout", "withdrawals", "out", "payment", "payments"],
  credit: ["credit", "paidin", "moneyin", "deposits", "in", "receipt", "receipts"],
  balance: ["balance", "runningbalance", "accountbalance"],
  type: ["type", "direction", "crdr", "debitcredit"],
  reference: ["reference", "ref", "transactionid", "externalref", "id", "number"],
};

export function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function aliasesFor(role: CsvColumnRole, profile?: CsvFormatProfile): string[] {
  return [...(profile?.headers[role] ?? []), ...GENERIC_ALIASES[role]];
}

export function detectProfile(headers: string[]): CsvFormatProfile {
  const normalized = headers.map(normalizeHeader);
  const scored = CSV_FORMAT_PROFILES.filter((profile) => profile.id !== "GENERIC").map((profile) => {
    const expected = Object.values(profile.headers).flat();
    const hits = expected.filter((alias) => normalized.includes(alias)).length;
    return { profile, hits, expected: expected.length };
  });
  scored.sort((left, right) => right.hits - left.hits || right.expected - left.expected);
  const best = scored[0];
  if (best && best.hits >= 3) {
    return best.profile;
  }
  return CSV_FORMAT_PROFILES.find((profile) => profile.id === "GENERIC")!;
}
