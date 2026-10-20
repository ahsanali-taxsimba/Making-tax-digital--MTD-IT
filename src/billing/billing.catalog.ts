export const BILLING_FEATURES = [
  "bookkeeping",
  "vat_returns",
  "mtd_it",
  "bank_feeds",
  "invoicing",
  "basic_reports",
  "unlimited_transactions",
  "ai_categorisation",
  "advanced_reports",
  "cashflow_dashboard",
  "multi_user",
  "priority_support",
  "bookkeeping_agent",
  "practice_clients",
] as const;

export type BillingFeature = (typeof BILLING_FEATURES)[number];

const LITE_FEATURES: BillingFeature[] = [
  "bookkeeping",
  "vat_returns",
  "mtd_it",
  "bank_feeds",
  "invoicing",
  "basic_reports",
];

const PRO_FEATURES: BillingFeature[] = [
  ...LITE_FEATURES,
  "unlimited_transactions",
  "ai_categorisation",
  "advanced_reports",
  "cashflow_dashboard",
  "multi_user",
  "priority_support",
  "bookkeeping_agent",
];

const PRACTICE_FEATURES: BillingFeature[] = [...PRO_FEATURES, "practice_clients"];

export interface BillingPlanSeed {
  slug: string;
  name: string;
  description: string;
  audience: "BUSINESS" | "PRACTICE";
  billingModel: "FLAT" | "PER_UNIT";
  unitAmountPence: number;
  vatPercent: number;
  minQuantity: number;
  maxQuantity: number | null;
  features: BillingFeature[];
  highlight: boolean;
  sortOrder: number;
}

/** Bootstrap catalog only. Additional plans are stored in BillingPlan and need no deploy. */
export const DEFAULT_BILLING_PLANS: BillingPlanSeed[] = [
  {
    slug: "ledger-lite",
    name: "Ledger Lite",
    description: "Bookkeeping, VAT returns, MTD IT, bank feeds, invoicing and basic reports.",
    audience: "BUSINESS",
    billingModel: "FLAT",
    unitAmountPence: 600,
    vatPercent: 20,
    minQuantity: 1,
    maxQuantity: 1,
    features: LITE_FEATURES,
    highlight: false,
    sortOrder: 10,
  },
  {
    slug: "ledger-pro",
    name: "Ledger Pro",
    description: "Everything in Lite, plus unlimited transactions, AI categorisation, the bookkeeping agent, advanced reports and multi-user access.",
    audience: "BUSINESS",
    billingModel: "FLAT",
    unitAmountPence: 1000,
    vatPercent: 20,
    minQuantity: 1,
    maxQuantity: null,
    features: PRO_FEATURES,
    highlight: true,
    sortOrder: 20,
  },
  {
    slug: "practice-start",
    name: "Practice Start",
    description: "For practices with up to 25 active clients. Billed per active client each month.",
    audience: "PRACTICE",
    billingModel: "PER_UNIT",
    unitAmountPence: 600,
    vatPercent: 20,
    minQuantity: 1,
    maxQuantity: 25,
    features: PRACTICE_FEATURES,
    highlight: false,
    sortOrder: 30,
  },
  {
    slug: "practice-growth",
    name: "Practice Growth",
    description: "For practices with more than 25 active clients. Lower per-client rate as you grow.",
    audience: "PRACTICE",
    billingModel: "PER_UNIT",
    unitAmountPence: 400,
    vatPercent: 20,
    minQuantity: 26,
    maxQuantity: null,
    features: PRACTICE_FEATURES,
    highlight: true,
    sortOrder: 40,
  },
];

export function featureList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => String(item));
  }
  return [];
}

export function vatPence(subtotalPence: number, vatPercent: number, inclusive: boolean): { taxPence: number; totalPence: number; netPence: number } {
  if (inclusive) {
    const netPence = Math.round(subtotalPence / (1 + vatPercent / 100));
    return { netPence, taxPence: subtotalPence - netPence, totalPence: subtotalPence };
  }
  const taxPence = Math.round(subtotalPence * (vatPercent / 100));
  return { netPence: subtotalPence, taxPence, totalPence: subtotalPence + taxPence };
}

export function mapStripeStatus(status?: string | null): "TRIAL" | "ACTIVE" | "PAST_DUE" | "CANCELLED" {
  const value = String(status ?? "").toLowerCase();
  if (value === "trialing") return "TRIAL";
  if (value === "past_due" || value === "unpaid" || value === "incomplete") return "PAST_DUE";
  if (value === "canceled" || value === "cancelled" || value === "incomplete_expired") return "CANCELLED";
  return "ACTIVE";
}
