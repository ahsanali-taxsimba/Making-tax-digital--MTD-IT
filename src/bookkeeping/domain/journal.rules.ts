import { BookkeepingError, BK_ERR } from "../bookkeeping.errors";
import { inRange, money, sumMoney } from "./money";

export interface DraftJournalLine {
  ledgerAccountId: string;
  debit: number;
  credit: number;
  taxCodeId?: string | null;
  description?: string | null;
}

export interface LedgerSnapshot {
  id: string;
  clientId: string;
  isActive: boolean;
  type: string;
  code: number;
  name: string;
  profile: string;
  category: string;
}

export interface TaxCodeSnapshot {
  id: string;
  code: string;
  name: string;
  rate: number;
  type: string;
}

export interface PeriodSnapshot {
  start: Date | string;
  end: Date | string;
  locked: boolean;
}

export interface JournalBalance {
  debits: number;
  credits: number;
  balanced: boolean;
}

export function journalTotals(lines: DraftJournalLine[]): JournalBalance {
  const debits = sumMoney(lines.map((line) => line.debit));
  const credits = sumMoney(lines.map((line) => line.credit));
  return { debits, credits, balanced: debits === credits };
}

export function assertBalancedJournal(lines: DraftJournalLine[]): JournalBalance {
  if (lines.length < 2) {
    throw new BookkeepingError(BK_ERR.UNBALANCED_JOURNAL, "A journal needs at least two lines");
  }
  for (const line of lines) {
    const debit = money(line.debit || 0);
    const credit = money(line.credit || 0);
    if (debit < 0 || credit < 0) {
      throw new BookkeepingError(BK_ERR.UNBALANCED_JOURNAL, "Journal lines cannot be negative");
    }
    if (debit === 0 && credit === 0) {
      throw new BookkeepingError(BK_ERR.UNBALANCED_JOURNAL, "Each journal line needs a debit or a credit");
    }
    if (debit > 0 && credit > 0) {
      throw new BookkeepingError(BK_ERR.UNBALANCED_JOURNAL, "A journal line cannot have both debit and credit");
    }
  }
  const totals = journalTotals(lines);
  if (!totals.balanced) {
    throw new BookkeepingError(
      BK_ERR.UNBALANCED_JOURNAL,
      `Journal does not balance: debits ${totals.debits.toFixed(2)} credits ${totals.credits.toFixed(2)}`,
      totals,
    );
  }
  return totals;
}

export function assertValidAccounts(
  lines: DraftJournalLine[],
  accounts: LedgerSnapshot[],
  clientId: string,
): LedgerSnapshot[] {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  return lines.map((line) => {
    const account = byId.get(line.ledgerAccountId);
    if (!account || account.clientId !== clientId) {
      throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, "Ledger account does not belong to this client", {
        ledgerAccountId: line.ledgerAccountId,
      });
    }
    if (!account.isActive) {
      throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, `Cannot post to inactive account ${account.code} ${account.name}`, {
        ledgerAccountId: account.id,
        code: account.code,
      });
    }
    return account;
  });
}

export function assertPeriodOpen(date: Date | string, periods: PeriodSnapshot[]): void {
  const locked = periods.find((period) => period.locked && inRange(date, period.start, period.end));
  if (locked) {
    throw new BookkeepingError(BK_ERR.PERIOD_LOCKED, "Accounting period is locked", {
      start: locked.start,
      end: locked.end,
    });
  }
}

export function isDebitNormal(account: Pick<LedgerSnapshot, "type" | "category" | "code">): boolean {
  if (account.type === "INCOME" || account.type === "LIABILITY" || account.type === "EQUITY" || account.type === "CAPITAL") {
    return false;
  }
  if (account.type === "EXPENSE" || account.type === "ASSET") {
    return true;
  }
  const category = account.category.toLowerCase();
  if (category === "income" || category === "liabilities" || category === "equity" || category === "vat") {
    return false;
  }
  if (category === "assets" || category.includes("expense") || category.includes("cost") || category.includes("purchases")) {
    return true;
  }
  if ([1100, 1200, 4000, 4010, 4020, 4200].includes(account.code)) {
    return true;
  }
  if ([2100, 2200, 2210, 2220, 2230, 2240, 2250, 2260, 3200, 4300, 4400, 4500, 4600, 4700].includes(account.code)) {
    return false;
  }
  return true;
}

export function signedMovement(
  account: Pick<LedgerSnapshot, "type" | "category" | "code">,
  debit: number,
  credit: number,
): number {
  const debitValue = money(debit);
  const creditValue = money(credit);
  return isDebitNormal(account) ? money(debitValue - creditValue) : money(creditValue - debitValue);
}

export function toTaxSnapshot(tax: { id: string; code: string; name: string; rate: unknown; type: string }): TaxCodeSnapshot {
  return { id: tax.id, code: tax.code, name: tax.name, rate: Number(tax.rate), type: tax.type };
}

export function classifyAccount(
  account: Pick<LedgerSnapshot, "type" | "category" | "code">,
): "asset" | "liability" | "equity" | "income" | "expense" {
  switch (account.type) {
    case "INCOME":
      return "income";
    case "EXPENSE":
      return "expense";
    case "ASSET":
      return "asset";
    case "LIABILITY":
      return "liability";
    case "EQUITY":
    case "CAPITAL":
      return "equity";
    default:
      break;
  }
  const category = account.category.toLowerCase();
  if (category === "income") return "income";
  if (category.includes("expense") || category.includes("cost") || category === "purchases" || category === "direct costs") {
    return "expense";
  }
  if (category === "assets") return "asset";
  if (category === "liabilities" || category === "vat") return "liability";
  if (category === "equity") return "equity";
  if ([1100, 1200, 4000, 4010, 4020, 4200].includes(account.code)) return "asset";
  if ([2100, 2200, 2210, 2220, 2230, 2240, 2250, 2260, 4300, 4400, 4500, 4600].includes(account.code)) {
    return "liability";
  }
  if ([3200, 4700, 4100].includes(account.code)) return "equity";
  return "asset";
}
