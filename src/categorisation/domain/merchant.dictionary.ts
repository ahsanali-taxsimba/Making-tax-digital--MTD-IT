import { TaxCodeKind } from "@prisma/client";
import { normalizeMerchantKey } from "./category-ledger";
import { MerchantRule } from "./types";

export const MERCHANT_DICTIONARY: MerchantRule[] = [
  {
    merchantKey: "bp",
    merchantName: "BP",
    aliases: ["bp fuel", "bp connect", "bp petrol", "bp pulse"],
    categoryKey: "fuel",
    ledgerCode: 3080,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Motor Expenses",
    confidence: 0.95,
  },
  {
    merchantKey: "shell",
    merchantName: "Shell",
    aliases: ["shell petrol", "shell fuel"],
    categoryKey: "fuel",
    ledgerCode: 3080,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Motor Expenses",
    confidence: 0.95,
  },
  {
    merchantKey: "esso",
    merchantName: "Esso",
    aliases: ["esso petrol"],
    categoryKey: "fuel",
    ledgerCode: 3080,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Motor Expenses",
    confidence: 0.93,
  },
  {
    merchantKey: "tesco",
    merchantName: "Tesco",
    aliases: ["tesco extra", "tesco express", "tesco metro", "tesco superstore"],
    categoryKey: "groceries",
    ledgerCode: 3050,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Office Costs",
    confidence: 0.95,
  },
  {
    merchantKey: "sainsbury",
    merchantName: "Sainsbury's",
    aliases: ["sainsburys", "sainsbury s"],
    categoryKey: "groceries",
    ledgerCode: 3050,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Office Costs",
    confidence: 0.93,
  },
  {
    merchantKey: "asda",
    merchantName: "Asda",
    aliases: [],
    categoryKey: "groceries",
    ledgerCode: 3050,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Office Costs",
    confidence: 0.92,
  },
  {
    merchantKey: "waitrose",
    merchantName: "Waitrose",
    aliases: [],
    categoryKey: "groceries",
    ledgerCode: 3050,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Office Costs",
    confidence: 0.92,
  },
  {
    merchantKey: "north ads agency",
    merchantName: "North Ads Agency",
    aliases: ["north ads"],
    categoryKey: "advertising",
    ledgerCode: 3000,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Advertising and Business Promotion",
    confidence: 0.94,
  },
  {
    merchantKey: "google ads",
    merchantName: "Google Ads",
    aliases: ["google adwords"],
    categoryKey: "advertising",
    ledgerCode: 3000,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Advertising and Business Promotion",
    confidence: 0.94,
  },
  {
    merchantKey: "brighton gallery ltd",
    merchantName: "Brighton Gallery Ltd",
    aliases: ["brighton gallery"],
    categoryKey: "sales",
    ledgerCode: 1000,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Turnover",
    confidence: 0.94,
  },
  {
    merchantKey: "starling",
    merchantName: "Starling",
    aliases: ["starling bank"],
    categoryKey: "bank_charges",
    ledgerCode: 3010,
    taxCodeKind: TaxCodeKind.NO_VAT,
    itsaCategory: "Bank, Credit Card and Financial Charges",
    confidence: 0.9,
  },
  {
    merchantKey: "adobe",
    merchantName: "Adobe",
    aliases: ["adobe creative cloud"],
    categoryKey: "subscriptions",
    ledgerCode: 3150,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Subscriptions",
    confidence: 0.93,
  },
  {
    merchantKey: "microsoft",
    merchantName: "Microsoft",
    aliases: ["microsoft 365", "office 365"],
    categoryKey: "subscriptions",
    ledgerCode: 3150,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Subscriptions",
    confidence: 0.92,
  },
  {
    merchantKey: "slack",
    merchantName: "Slack",
    aliases: [],
    categoryKey: "subscriptions",
    ledgerCode: 3150,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Subscriptions",
    confidence: 0.92,
  },
  {
    merchantKey: "zoom",
    merchantName: "Zoom",
    aliases: [],
    categoryKey: "subscriptions",
    ledgerCode: 3150,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Subscriptions",
    confidence: 0.9,
  },
  {
    merchantKey: "uber",
    merchantName: "Uber",
    aliases: ["uber trip"],
    categoryKey: "travel",
    ledgerCode: 3090,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Travel and Subsistence",
    confidence: 0.9,
  },
  {
    merchantKey: "trainline",
    merchantName: "Trainline",
    aliases: [],
    categoryKey: "travel",
    ledgerCode: 3090,
    taxCodeKind: TaxCodeKind.VAT_STANDARD,
    itsaCategory: "Travel and Subsistence",
    confidence: 0.9,
  },
];

export function matchMerchant(
  merchantName: string | null | undefined,
  description: string,
  rules: MerchantRule[] = MERCHANT_DICTIONARY,
): MerchantRule | null {
  const haystack = normalizeMerchantKey(`${merchantName ?? ""} ${description}`);
  if (!haystack) {
    return null;
  }
  let best: MerchantRule | null = null;
  for (const rule of rules) {
    const needles = [rule.merchantKey, ...rule.aliases.map(normalizeMerchantKey)].filter(Boolean);
    const hit = needles.some((needle) => haystack === needle || haystack.includes(needle) || needle.includes(haystack));
    if (!hit) {
      continue;
    }
    if (!best || rule.confidence > best.confidence || (rule.confidence === best.confidence && rule.merchantKey.length > best.merchantKey.length)) {
      best = rule;
    }
  }
  return best;
}
