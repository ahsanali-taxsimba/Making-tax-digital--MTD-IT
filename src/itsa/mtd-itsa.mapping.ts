import { ChartProfile } from "@prisma/client";

export type ItsaMappingBucket =
  | "business_income"
  | "business_expenses_allowable"
  | "business_expenses_disallowable"
  | "capital_items"
  | "property_income"
  | "property_expenses";

export interface ItsaMappedCode {
  code: number;
  category: string;
}

export const MTD_ITSA_MAPPING: Record<ItsaMappingBucket, ItsaMappedCode[]> = {
  business_income: [
    { code: 1000, category: "Turnover" },
    { code: 1010, category: "Turnover" },
    { code: 1020, category: "Turnover" },
    { code: 1040, category: "Other Business Income" },
  ],
  business_expenses_allowable: [
    { code: 2000, category: "Cost of Goods Sold" },
    { code: 2010, category: "Cost of Goods Sold" },
    { code: 2020, category: "Cost of Goods Sold" },
    { code: 2030, category: "Wages, Salaries and Staff Costs" },
    { code: 3000, category: "Advertising and Business Promotion" },
    { code: 3010, category: "Bank, Credit Card and Financial Charges" },
    { code: 3020, category: "Insurance" },
    { code: 3030, category: "Office Costs" },
    { code: 3040, category: "Telephone, Mobile, Internet" },
    { code: 3050, category: "Office Costs" },
    { code: 3060, category: "Rent, Rates, Power and Insurance Costs" },
    { code: 3070, category: "Repairs and Maintenance" },
    { code: 3080, category: "Motor Expenses" },
    { code: 3090, category: "Travel and Subsistence" },
    { code: 3100, category: "Professional Fees" },
    { code: 3110, category: "Wages, Salaries and Staff Costs" },
    { code: 3120, category: "Wages, Salaries and Staff Costs" },
    { code: 3130, category: "Pension Contributions" },
    { code: 3140, category: "Training" },
    { code: 3150, category: "Subscriptions" },
  ],
  business_expenses_disallowable: [
    { code: 4300, category: "Non-allowable Entertainment" },
    { code: 4400, category: "Non-allowable General Expenses" },
  ],
  capital_items: [
    { code: 4000, category: "Capital Expenditure (Not in Quarterly Update)" },
    { code: 4010, category: "Capital Expenditure (Not in Quarterly Update)" },
    { code: 4020, category: "Capital Expenditure (Not in Quarterly Update)" },
  ],
  property_income: [
    { code: 2000, category: "UK Property Income" },
    { code: 2010, category: "UK Property Income" },
    { code: 2020, category: "UK Property Income" },
    { code: 2030, category: "UK Property Income" },
    { code: 2050, category: "Other Property Income" },
  ],
  property_expenses: [
    { code: 3000, category: "Property Repairs and Maintenance" },
    { code: 3010, category: "Property Insurance" },
    { code: 3020, category: "Loan Interest (Restricted)" },
    { code: 3030, category: "Agent Fees" },
    { code: 3040, category: "Service Charges" },
    { code: 3050, category: "Utilities" },
    { code: 3060, category: "Council Tax" },
    { code: 3070, category: "Ground Rent" },
    { code: 3080, category: "Cleaning and Gardening" },
    { code: 3090, category: "Safety Certificates" },
    { code: 3100, category: "Advertising for Tenants" },
    { code: 3110, category: "Legal Fees" },
    { code: 3120, category: "Accountancy Fees" },
    { code: 3130, category: "Travel for Property Management" },
    { code: 3140, category: "Replacement Domestic Items Relief" },
  ],
};

const INCLUDED_BUCKETS = new Set<ItsaMappingBucket>([
  "business_income",
  "business_expenses_allowable",
  "property_income",
  "property_expenses",
]);

export interface ItsaAccountMapping {
  bucket: ItsaMappingBucket;
  category: string;
  hmrcKey: string;
  includedInQuarterlyUpdate: boolean;
  profile: ChartProfile;
}

function toHmrcKey(category: string): string {
  return category
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((part, index) => (index === 0 ? part.toLowerCase() : part[0].toUpperCase() + part.slice(1).toLowerCase()))
    .join("");
}

function indexForBuckets(buckets: ItsaMappingBucket[], profile: ChartProfile): Map<number, ItsaAccountMapping> {
  const index = new Map<number, ItsaAccountMapping>();
  for (const bucket of buckets) {
    for (const item of MTD_ITSA_MAPPING[bucket]) {
      index.set(item.code, {
        bucket,
        category: item.category,
        hmrcKey: toHmrcKey(item.category),
        includedInQuarterlyUpdate: INCLUDED_BUCKETS.has(bucket),
        profile,
      });
    }
  }
  return index;
}

const SOLE_TRADER_INDEX = indexForBuckets(
  ["business_income", "business_expenses_allowable", "business_expenses_disallowable", "capital_items"],
  ChartProfile.SOLE_TRADER,
);

const LANDLORD_INDEX = indexForBuckets(["property_income", "property_expenses", "capital_items"], ChartProfile.LANDLORD);

export function lookupItsaMapping(profile: ChartProfile, code: number): ItsaAccountMapping | undefined {
  if (profile === ChartProfile.LANDLORD) {
    return LANDLORD_INDEX.get(code);
  }
  if (profile === ChartProfile.SOLE_TRADER) {
    return SOLE_TRADER_INDEX.get(code);
  }
  return undefined;
}

export function chartProfileForBusinessType(type: string): ChartProfile {
  return /property/i.test(type) ? ChartProfile.LANDLORD : ChartProfile.SOLE_TRADER;
}

export function decorateAccountWithItsa<T extends { code: number; profile: ChartProfile }>(account: T) {
  return { ...account, itsa: lookupItsaMapping(account.profile, account.code) ?? null };
}
