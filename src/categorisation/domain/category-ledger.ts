import { ChartProfile } from "@prisma/client";
import { CategoryKey } from "./types";

const SOLE_TRADER: Record<CategoryKey, number> = {
  fuel: 3080,
  groceries: 3050,
  restaurants: 3090,
  advertising: 3000,
  bank_charges: 3010,
  sales: 1000,
  subscriptions: 3150,
  travel: 3090,
  insurance: 3020,
  professional: 3100,
  telecom: 3040,
  software: 3030,
  office: 3050,
  rent: 3060,
  utilities: 3060,
  entertainment: 4300,
  wages: 3110,
};

const COMPANY: Record<CategoryKey, number> = {
  fuel: 3070,
  groceries: 3030,
  restaurants: 3080,
  advertising: 3000,
  bank_charges: 3010,
  sales: 1000,
  subscriptions: 3030,
  travel: 3080,
  insurance: 3020,
  professional: 3090,
  telecom: 3030,
  software: 3030,
  office: 3030,
  rent: 3040,
  utilities: 3050,
  entertainment: 3080,
  wages: 3100,
};

const LANDLORD: Record<CategoryKey, number> = {
  fuel: 3130,
  groceries: 3080,
  restaurants: 3130,
  advertising: 3100,
  bank_charges: 3120,
  sales: 2000,
  subscriptions: 3120,
  travel: 3130,
  insurance: 3010,
  professional: 3120,
  telecom: 3050,
  software: 3120,
  office: 3120,
  rent: 3070,
  utilities: 3050,
  entertainment: 3130,
  wages: 3080,
};

export function ledgerCodeFor(profile: ChartProfile, categoryKey: CategoryKey, fallback?: number): number {
  const table =
    profile === ChartProfile.LANDLORD ? LANDLORD : profile === ChartProfile.COMPANY ? COMPANY : SOLE_TRADER;
  return table[categoryKey] ?? fallback ?? SOLE_TRADER[categoryKey];
}

export function defaultIncomeCode(profile: ChartProfile): number {
  return profile === ChartProfile.LANDLORD ? 2000 : 1000;
}

export function defaultExpenseCode(_profile: ChartProfile): number {
  return 3000;
}

export function normalizeMerchantKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
