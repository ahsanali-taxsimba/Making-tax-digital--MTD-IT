import { ChartProfile } from "@prisma/client";

export type VatBoxId = "box_1" | "box_2" | "box_3" | "box_4" | "box_5" | "box_6" | "box_7" | "box_8" | "box_9";

export interface VatBoxDefinition {
  name: string;
  description: string;
  maps_from: string[];
  calculated?: boolean;
}

export const VAT_BOX_MAPPING: Record<VatBoxId, VatBoxDefinition> = {
  box_1: {
    name: "VAT due on sales and other outputs",
    description: "Total output VAT charged on standard-rated, reduced-rated, and zero-rated sales.",
    maps_from: ["VAT on Sales", "Output VAT from invoices", "VAT on EU/overseas sales (post-Brexit rules apply)"],
  },
  box_2: {
    name: "VAT due on acquisitions from EU member states",
    description: "VAT due on goods acquired from EU countries (only applies to NI businesses under the Protocol).",
    maps_from: ["VAT on EU acquisitions", "Reverse charge VAT on EU goods"],
  },
  box_3: {
    name: "Total VAT due (Box 1 + Box 2)",
    description: "Automatically calculated total VAT due.",
    maps_from: ["box_1", "box_2"],
    calculated: true,
  },
  box_4: {
    name: "VAT reclaimed on purchases and other inputs",
    description: "Total input VAT on business purchases, expenses, imports, and reverse-charge services.",
    maps_from: ["VAT on Purchases", "VAT on Expenses", "Import VAT", "Reverse charge VAT on services"],
  },
  box_5: {
    name: "Net VAT to pay or reclaim",
    description: "Difference between VAT due (Box 3) and VAT reclaimed (Box 4).",
    maps_from: ["box_3", "box_4"],
    calculated: true,
  },
  box_6: {
    name: "Total value of sales (excluding VAT)",
    description: "Total net sales value including zero-rated and exempt sales.",
    maps_from: ["Sales", "Turnover", "Zero-rated sales", "Exempt sales"],
  },
  box_7: {
    name: "Total value of purchases (excluding VAT)",
    description: "Total net purchases and expenses including imports.",
    maps_from: ["Purchases", "Expenses", "Imports", "Reverse charge purchases"],
  },
  box_8: {
    name: "Total value of supplies to EU member states",
    description: "Value of goods supplied to EU countries (NI businesses only).",
    maps_from: ["EU goods supplied"],
  },
  box_9: {
    name: "Total value of acquisitions from EU member states",
    description: "Value of goods acquired from EU countries (NI businesses only).",
    maps_from: ["EU goods acquired"],
  },
};

export const VAT_BOX_FIELD = {
  box_1: "vatDueSales",
  box_2: "vatDueAcquisitions",
  box_3: "totalVatDue",
  box_4: "vatReclaimedCurrPeriod",
  box_5: "netVatDue",
  box_6: "totalValueSalesExVAT",
  box_7: "totalValuePurchasesExVAT",
  box_8: "totalValueGoodsSuppliedExVAT",
  box_9: "totalAcquisitionsExVAT",
} as const;

export type VatBoxInput = {
  vatDueSales: number;
  vatDueAcquisitions: number;
  vatReclaimedCurrPeriod: number;
  totalValueSalesExVAT: number;
  totalValuePurchasesExVAT: number;
  totalValueGoodsSuppliedExVAT: number;
  totalAcquisitionsExVAT: number;
};

const SOURCE_BOX_FIELD = {
  box_1: "vatDueSales",
  box_2: "vatDueAcquisitions",
  box_4: "vatReclaimedCurrPeriod",
  box_6: "totalValueSalesExVAT",
  box_7: "totalValuePurchasesExVAT",
  box_8: "totalValueGoodsSuppliedExVAT",
  box_9: "totalAcquisitionsExVAT",
} as const;

const SOURCE_TO_BOXES = new Map<string, VatBoxId[]>();
for (const [box, definition] of Object.entries(VAT_BOX_MAPPING) as [VatBoxId, VatBoxDefinition][]) {
  if (definition.calculated) {
    continue;
  }
  for (const source of definition.maps_from) {
    const current = SOURCE_TO_BOXES.get(source) ?? [];
    current.push(box);
    SOURCE_TO_BOXES.set(source, current);
  }
}

const COMMON_VAT_ACCOUNTS: Array<{
  code: number;
  name: string;
  category: string;
  type: "income" | "expense" | "capital" | "balance_sheet";
}> = [
  { code: 1060, name: "Zero-rated Sales", category: "Income", type: "income" },
  { code: 1070, name: "Exempt Sales", category: "Income", type: "income" },
  { code: 2200, name: "VAT on Sales", category: "VAT", type: "balance_sheet" },
  { code: 2210, name: "VAT on EU Acquisitions", category: "VAT", type: "balance_sheet" },
  { code: 2220, name: "VAT on Purchases", category: "VAT", type: "balance_sheet" },
  { code: 2230, name: "VAT on Expenses", category: "VAT", type: "balance_sheet" },
  { code: 2240, name: "Import VAT", category: "VAT", type: "balance_sheet" },
  { code: 2250, name: "Reverse Charge VAT on Services", category: "VAT", type: "balance_sheet" },
  { code: 2260, name: "Reverse Charge VAT on EU Goods", category: "VAT", type: "balance_sheet" },
  { code: 5100, name: "EU Goods Supplied", category: "VAT", type: "income" },
  { code: 5110, name: "EU Goods Acquired", category: "VAT", type: "expense" },
  { code: 5120, name: "Reverse Charge Purchases", category: "VAT", type: "expense" },
];

export const VAT_LEDGER_ACCOUNTS = COMMON_VAT_ACCOUNTS;

const VAT_SOURCES_BY_CODE: Record<number, string[]> = {
  1000: ["Sales", "Turnover"],
  1010: ["Sales", "Turnover"],
  1020: ["Sales", "Turnover"],
  1030: ["Sales"],
  1040: ["Sales", "Turnover"],
  1060: ["Zero-rated sales"],
  1070: ["Exempt sales"],
  2000: ["Purchases"],
  2010: ["Purchases"],
  2020: ["Purchases"],
  2200: ["VAT on Sales", "Output VAT from invoices"],
  2210: ["VAT on EU acquisitions"],
  2220: ["VAT on Purchases"],
  2230: ["VAT on Expenses"],
  2240: ["Import VAT"],
  2250: ["Reverse charge VAT on services"],
  2260: ["Reverse charge VAT on EU goods"],
  5100: ["EU goods supplied"],
  5110: ["EU goods acquired"],
  5120: ["Reverse charge purchases", "Purchases"],
};

const EXPENSE_CODES_AS_EXPENSES = new Set([
  2030, 3000, 3010, 3020, 3030, 3040, 3050, 3060, 3070, 3080, 3090, 3100, 3110, 3120, 3130, 3140, 3150,
]);

const LANDLORD_INCOME = new Set([2000, 2010, 2020, 2030, 2050]);
const LANDLORD_EXPENSE = new Set([
  3000, 3010, 3020, 3030, 3040, 3050, 3060, 3070, 3080, 3090, 3100, 3110, 3120, 3130, 3140,
]);

export interface VatAccountMapping {
  sources: string[];
  boxes: VatBoxId[];
}

export function vatSourcesFor(profile: ChartProfile, code: number): string[] {
  if (profile === ChartProfile.LANDLORD) {
    if (LANDLORD_INCOME.has(code)) return ["Sales"];
    if (LANDLORD_EXPENSE.has(code)) return ["Expenses"];
  }
  if (VAT_SOURCES_BY_CODE[code]) {
    return VAT_SOURCES_BY_CODE[code];
  }
  if (EXPENSE_CODES_AS_EXPENSES.has(code)) {
    return ["Expenses"];
  }
  return [];
}

export function lookupVatMapping(profile: ChartProfile, code: number): VatAccountMapping | null {
  const sources = vatSourcesFor(profile, code);
  if (sources.length === 0) {
    return null;
  }
  const boxes = Array.from(new Set(sources.flatMap((source) => SOURCE_TO_BOXES.get(source) ?? [])));
  return { sources, boxes };
}

export function decorateAccountWithVat<T extends { code: number; profile: ChartProfile }>(account: T) {
  return { ...account, vat: lookupVatMapping(account.profile, account.code) };
}

export function emptyVatBoxInput(): VatBoxInput {
  return {
    vatDueSales: 0,
    vatDueAcquisitions: 0,
    vatReclaimedCurrPeriod: 0,
    totalValueSalesExVAT: 0,
    totalValuePurchasesExVAT: 0,
    totalValueGoodsSuppliedExVAT: 0,
    totalAcquisitionsExVAT: 0,
  };
}

export function boxesFromSources(amount: number, sources: string[]): Partial<Record<VatBoxId, number>> {
  const boxes = Array.from(new Set(sources.flatMap((source) => SOURCE_TO_BOXES.get(source) ?? [])));
  const totals: Partial<Record<VatBoxId, number>> = {};
  const rounded = Number(amount.toFixed(2));
  for (const box of boxes) {
    totals[box] = rounded;
  }
  return totals;
}

export function applyAmountToVatBoxes(input: VatBoxInput, amount: number, boxes: VatBoxId[]) {
  for (const box of boxes) {
    const field = SOURCE_BOX_FIELD[box as keyof typeof SOURCE_BOX_FIELD];
    if (!field) {
      continue;
    }
    input[field] = Number((input[field] + amount).toFixed(2));
  }
  return input;
}

export function describeVatBoxes(totals: ReturnType<typeof finaliseVatBoxes>) {
  const values: Record<VatBoxId, number> = {
    box_1: totals.vatDueSales,
    box_2: totals.vatDueAcquisitions,
    box_3: totals.totalVatDue,
    box_4: totals.vatReclaimedCurrPeriod,
    box_5: totals.netVatDue,
    box_6: totals.totalValueSalesExVAT,
    box_7: totals.totalValuePurchasesExVAT,
    box_8: totals.totalValueGoodsSuppliedExVAT,
    box_9: totals.totalAcquisitionsExVAT,
  };
  return (Object.entries(VAT_BOX_MAPPING) as [VatBoxId, VatBoxDefinition][]).map(([id, definition]) => ({
    id,
    ...definition,
    field: VAT_BOX_FIELD[id],
    value: values[id],
  }));
}

export function finaliseVatBoxes(input: {
  vatDueSales: number;
  vatDueAcquisitions: number;
  vatReclaimedCurrPeriod: number;
  totalValueSalesExVAT: number;
  totalValuePurchasesExVAT: number;
  totalValueGoodsSuppliedExVAT: number;
  totalAcquisitionsExVAT: number;
}) {
  const vatDueSales = round2(input.vatDueSales);
  const vatDueAcquisitions = round2(input.vatDueAcquisitions);
  const totalVatDue = round2(vatDueSales + vatDueAcquisitions);
  const vatReclaimedCurrPeriod = round2(input.vatReclaimedCurrPeriod);
  const netVatDue = round2(Math.abs(totalVatDue - vatReclaimedCurrPeriod));
  return {
    vatDueSales,
    vatDueAcquisitions,
    totalVatDue,
    vatReclaimedCurrPeriod,
    netVatDue,
    totalValueSalesExVAT: round2(input.totalValueSalesExVAT),
    totalValuePurchasesExVAT: round2(input.totalValuePurchasesExVAT),
    totalValueGoodsSuppliedExVAT: round2(input.totalValueGoodsSuppliedExVAT),
    totalAcquisitionsExVAT: round2(input.totalAcquisitionsExVAT),
  };
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
