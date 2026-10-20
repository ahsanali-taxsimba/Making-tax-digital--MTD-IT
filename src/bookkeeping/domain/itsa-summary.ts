import { ChartProfile } from "@prisma/client";
import { chartProfileForBusinessType, lookupItsaMapping } from "../../itsa/mtd-itsa.mapping";
import { classifyAccount, LedgerSnapshot } from "./journal.rules";
import { money } from "./money";

export interface ItsaJournalLine {
  ledger: LedgerSnapshot;
  debit: number;
  credit: number;
}

export function resolveItsaProfile(businessType?: string): ChartProfile | undefined {
  if (!businessType || businessType === "all") {
    return undefined;
  }
  if (/landlord|property/i.test(businessType)) {
    return ChartProfile.LANDLORD;
  }
  if (/company/i.test(businessType)) {
    return ChartProfile.COMPANY;
  }
  return chartProfileForBusinessType(businessType);
}

export function itsaSummaryFromJournals(lines: ItsaJournalLine[], businessType?: string) {
  const profileFilter = resolveItsaProfile(businessType);
  const incomes: Record<string, number> = {};
  const expenses: Record<string, number> = {};
  const capital: Record<string, number> = {};
  const disallowable: Record<string, number> = {};
  const detail: Array<{
    code: number;
    name: string;
    profile: string;
    amount: number;
    bucket: string;
    category: string;
    hmrcKey: string;
    includedInQuarterlyUpdate: boolean;
  }> = [];
  const excluded: Array<{ code: number; name: string; amount: number; reason: string }> = [];

  for (const line of lines) {
    if (profileFilter && line.ledger.profile !== profileFilter) {
      continue;
    }
    const classification = classifyAccount(line.ledger);
    const amount =
      classification === "income"
        ? money(Number(line.credit) - Number(line.debit))
        : money(Number(line.debit) - Number(line.credit));
    if (amount === 0) {
      continue;
    }
    const mapping = lookupItsaMapping(line.ledger.profile as ChartProfile, line.ledger.code);
    if (!mapping) {
      excluded.push({ code: line.ledger.code, name: line.ledger.name, amount, reason: "unmapped" });
      continue;
    }
    const target =
      mapping.bucket === "capital_items"
        ? capital
        : mapping.bucket.endsWith("disallowable")
          ? disallowable
          : mapping.bucket.endsWith("income")
            ? incomes
            : expenses;
    target[mapping.hmrcKey] = money((target[mapping.hmrcKey] ?? 0) + amount);
    detail.push({
      code: line.ledger.code,
      name: line.ledger.name,
      profile: line.ledger.profile,
      amount,
      bucket: mapping.bucket,
      category: mapping.category,
      hmrcKey: mapping.hmrcKey,
      includedInQuarterlyUpdate: mapping.includedInQuarterlyUpdate,
    });
  }

  const quarterlyIncomes = { ...incomes };
  const quarterlyExpenses = { ...expenses };
  return {
    businessType: businessType ?? "all",
    profile: profileFilter ?? "ALL",
    incomes,
    expenses,
    capital,
    disallowable,
    quarterly: { incomes: quarterlyIncomes, expenses: quarterlyExpenses },
    lines: detail,
    excluded,
    totals: {
      income: money(Object.values(incomes).reduce((total, value) => total + value, 0)),
      expenses: money(Object.values(expenses).reduce((total, value) => total + value, 0)),
      capital: money(Object.values(capital).reduce((total, value) => total + value, 0)),
      disallowable: money(Object.values(disallowable).reduce((total, value) => total + value, 0)),
    },
  };
}
