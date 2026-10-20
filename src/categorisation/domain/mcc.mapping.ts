import { TaxCodeKind } from "@prisma/client";
import { MccRule } from "./types";

export const MCC_MAPPING: MccRule[] = [
  { mcc: "5411", industry: "Grocery stores / supermarkets", categoryKey: "groceries", ledgerCode: 3050, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Office Costs", confidence: 0.85 },
  { mcc: "5541", industry: "Service stations", categoryKey: "fuel", ledgerCode: 3080, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Motor Expenses", confidence: 0.88 },
  { mcc: "5542", industry: "Automated fuel dispensers", categoryKey: "fuel", ledgerCode: 3080, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Motor Expenses", confidence: 0.88 },
  { mcc: "5812", industry: "Restaurants", categoryKey: "restaurants", ledgerCode: 3090, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Travel and Subsistence", confidence: 0.9 },
  { mcc: "5814", industry: "Fast food restaurants", categoryKey: "restaurants", ledgerCode: 3090, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Travel and Subsistence", confidence: 0.88 },
  { mcc: "4111", industry: "Local and suburban commuter transport", categoryKey: "travel", ledgerCode: 3090, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Travel and Subsistence", confidence: 0.82 },
  { mcc: "4121", industry: "Taxicabs and limousines", categoryKey: "travel", ledgerCode: 3090, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Travel and Subsistence", confidence: 0.84 },
  { mcc: "7011", industry: "Hotels and lodging", categoryKey: "travel", ledgerCode: 3090, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Travel and Subsistence", confidence: 0.84 },
  { mcc: "4814", industry: "Telecommunication services", categoryKey: "telecom", ledgerCode: 3040, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Telephone, Mobile, Internet", confidence: 0.86 },
  { mcc: "4899", industry: "Cable and pay television", categoryKey: "subscriptions", ledgerCode: 3150, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Subscriptions", confidence: 0.82 },
  { mcc: "4900", industry: "Utilities", categoryKey: "utilities", ledgerCode: 3060, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Rent, Rates, Power and Insurance Costs", confidence: 0.84 },
  { mcc: "5968", industry: "Direct marketing / subscriptions", categoryKey: "subscriptions", ledgerCode: 3150, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Subscriptions", confidence: 0.86 },
  { mcc: "5734", industry: "Computer software stores", categoryKey: "software", ledgerCode: 3030, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Office Costs", confidence: 0.84 },
  { mcc: "5816", industry: "Digital goods — games", categoryKey: "subscriptions", ledgerCode: 3150, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Subscriptions", confidence: 0.8 },
  { mcc: "5817", industry: "Digital goods — applications", categoryKey: "subscriptions", ledgerCode: 3150, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Subscriptions", confidence: 0.84 },
  { mcc: "5818", industry: "Digital goods — large merchants", categoryKey: "subscriptions", ledgerCode: 3150, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Subscriptions", confidence: 0.82 },
  { mcc: "7311", industry: "Advertising services", categoryKey: "advertising", ledgerCode: 3000, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Advertising and Business Promotion", confidence: 0.88 },
  { mcc: "7372", industry: "Computer programming and data processing", categoryKey: "software", ledgerCode: 3030, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Office Costs", confidence: 0.82 },
  { mcc: "7392", industry: "Management, consulting and public relations", categoryKey: "professional", ledgerCode: 3100, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Professional Fees", confidence: 0.84 },
  { mcc: "6513", industry: "Real estate agents and managers", categoryKey: "professional", ledgerCode: 3100, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Professional Fees", confidence: 0.8 },
  { mcc: "5942", industry: "Book stores", categoryKey: "office", ledgerCode: 3050, taxCodeKind: TaxCodeKind.VAT_ZERO, vatable: false, itsaCategory: "Office Costs", confidence: 0.8 },
  { mcc: "5999", industry: "Miscellaneous retail", categoryKey: "office", ledgerCode: 3050, taxCodeKind: TaxCodeKind.VAT_STANDARD, vatable: true, itsaCategory: "Office Costs", confidence: 0.7 },
  { mcc: "6300", industry: "Insurance sales and underwriting", categoryKey: "insurance", ledgerCode: 3020, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Insurance", confidence: 0.9 },
  { mcc: "6010", industry: "Manual cash disbursements", categoryKey: "bank_charges", ledgerCode: 3010, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Bank, Credit Card and Financial Charges", confidence: 0.86 },
  { mcc: "6011", industry: "Automated cash disbursements (ATM)", categoryKey: "bank_charges", ledgerCode: 3010, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Bank, Credit Card and Financial Charges", confidence: 0.86 },
  { mcc: "6012", industry: "Financial institutions — merchandise and services", categoryKey: "bank_charges", ledgerCode: 3010, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Bank, Credit Card and Financial Charges", confidence: 0.88 },
  { mcc: "6051", industry: "Non-financial institutions — foreign currency", categoryKey: "bank_charges", ledgerCode: 3010, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Bank, Credit Card and Financial Charges", confidence: 0.82 },
  { mcc: "6211", industry: "Securities brokers and dealers", categoryKey: "bank_charges", ledgerCode: 3010, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Bank, Credit Card and Financial Charges", confidence: 0.82 },
  { mcc: "8011", industry: "Doctors and physicians", categoryKey: "professional", ledgerCode: 3100, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Professional Fees", confidence: 0.86 },
  { mcc: "8062", industry: "Hospitals", categoryKey: "professional", ledgerCode: 3100, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Professional Fees", confidence: 0.86 },
  { mcc: "8211", industry: "Elementary and secondary schools", categoryKey: "professional", ledgerCode: 3100, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Training", confidence: 0.84 },
  { mcc: "8220", industry: "Colleges and universities", categoryKey: "professional", ledgerCode: 3140, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Training", confidence: 0.84 },
  { mcc: "8299", industry: "Schools and educational services", categoryKey: "professional", ledgerCode: 3140, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Training", confidence: 0.84 },
  { mcc: "8398", industry: "Charitable and social service organisations", categoryKey: "office", ledgerCode: 3050, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Office Costs", confidence: 0.78 },
  { mcc: "9311", industry: "Tax payments", categoryKey: "bank_charges", ledgerCode: 3010, taxCodeKind: TaxCodeKind.NO_VAT, vatable: false, itsaCategory: "Bank, Credit Card and Financial Charges", confidence: 0.88 },
];

const EXEMPT_MCC_RANGES: Array<[number, number]> = [
  [6010, 6051],
  [6211, 6211],
  [6300, 6399],
  [8011, 8099],
  [8211, 8299],
  [8398, 8398],
  [9311, 9311],
];

export const VATABLE_MCCS = new Set(MCC_MAPPING.filter((rule) => rule.vatable).map((rule) => rule.mcc));
export const EXEMPT_MCCS = new Set(MCC_MAPPING.filter((rule) => !rule.vatable).map((rule) => rule.mcc));

export function normalizeMcc(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const digits = value.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(0, 4) : null;
}

export function matchMcc(mcc: string | null | undefined, rules: MccRule[] = MCC_MAPPING): MccRule | null {
  const code = normalizeMcc(mcc);
  if (!code) {
    return null;
  }
  return rules.find((rule) => rule.mcc === code) ?? null;
}

export function isExemptMcc(mcc: string | null | undefined): boolean {
  const code = normalizeMcc(mcc);
  if (!code) {
    return false;
  }
  if (EXEMPT_MCCS.has(code)) {
    return true;
  }
  const numeric = Number(code);
  return EXEMPT_MCC_RANGES.some(([from, to]) => numeric >= from && numeric <= to);
}

export function isVatableMcc(mcc: string | null | undefined): boolean {
  const code = normalizeMcc(mcc);
  if (!code || isExemptMcc(code)) {
    return false;
  }
  return VATABLE_MCCS.has(code);
}
