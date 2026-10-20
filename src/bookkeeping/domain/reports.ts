import { classifyAccount, LedgerSnapshot, signedMovement } from "./journal.rules";
import { inRange, money, toIsoDate } from "./money";

export interface PostedLine {
  ledgerAccountId: string;
  debit: number;
  credit: number;
  date: Date | string;
}

export interface TrialBalanceRow {
  ledgerAccountId: string;
  code: number;
  name: string;
  type: string;
  classification: ReturnType<typeof classifyAccount>;
  opening: number;
  debit: number;
  credit: number;
  movement: number;
  closing: number;
}

export function trialBalance(
  accounts: Array<LedgerSnapshot & { openingBalance?: number }>,
  lines: PostedLine[],
  periodStart: string,
  periodEnd: string,
): TrialBalanceRow[] {
  return accounts
    .map((account) => {
      const openingExtra = lines
        .filter((line) => line.ledgerAccountId === account.id && toIsoDate(line.date) < periodStart)
        .reduce((total, line) => total + signedMovement(account, line.debit, line.credit), Number(account.openingBalance ?? 0));
      const periodLines = lines.filter(
        (line) => line.ledgerAccountId === account.id && inRange(line.date, periodStart, periodEnd),
      );
      const debit = money(periodLines.reduce((total, line) => total + Number(line.debit), 0));
      const credit = money(periodLines.reduce((total, line) => total + Number(line.credit), 0));
      const movement = signedMovement(account, debit, credit);
      return {
        ledgerAccountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        classification: classifyAccount(account),
        opening: money(openingExtra),
        debit,
        credit,
        movement,
        closing: money(openingExtra + movement),
      };
    })
    .filter((row) => row.opening !== 0 || row.debit !== 0 || row.credit !== 0)
    .sort((left, right) => left.code - right.code);
}

export function profitAndLoss(rows: TrialBalanceRow[]) {
  const income = rows.filter((row) => row.classification === "income");
  const expenses = rows.filter((row) => row.classification === "expense");
  const incomeTotal = money(income.reduce((total, row) => total + row.movement, 0));
  const expenseTotal = money(expenses.reduce((total, row) => total + row.movement, 0));
  return {
    income: income.map((row) => ({ code: row.code, name: row.name, amount: row.movement })),
    expenses: expenses.map((row) => ({ code: row.code, name: row.name, amount: row.movement })),
    totals: {
      income: incomeTotal,
      expenses: expenseTotal,
      netProfit: money(incomeTotal - expenseTotal),
    },
  };
}

export function balanceSheet(rows: TrialBalanceRow[]) {
  const assets = rows.filter((row) => row.classification === "asset");
  const liabilities = rows.filter((row) => row.classification === "liability");
  const equity = rows.filter((row) => row.classification === "equity");
  const pl = profitAndLoss(rows);
  const assetTotal = money(assets.reduce((total, row) => total + row.closing, 0));
  const liabilityTotal = money(liabilities.reduce((total, row) => total + row.closing, 0));
  const equityTotal = money(equity.reduce((total, row) => total + row.closing, 0) + pl.totals.netProfit);
  return {
    assets: assets.map((row) => ({ code: row.code, name: row.name, amount: row.closing })),
    liabilities: liabilities.map((row) => ({ code: row.code, name: row.name, amount: row.closing })),
    equity: [
      ...equity.map((row) => ({ code: row.code, name: row.name, amount: row.closing })),
      { code: 9999, name: "Current year profit/(loss)", amount: pl.totals.netProfit },
    ],
    totals: {
      assets: assetTotal,
      liabilities: liabilityTotal,
      equity: equityTotal,
      balanced: assetTotal === money(liabilityTotal + equityTotal),
    },
  };
}
