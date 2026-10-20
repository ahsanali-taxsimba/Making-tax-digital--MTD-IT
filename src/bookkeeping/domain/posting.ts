import { BookkeepingError, BK_ERR } from "../bookkeeping.errors";
import { DraftJournalLine, LedgerSnapshot, signedMovement } from "./journal.rules";
import { money } from "./money";
import { TaxCodeSnapshot, vatOnNet } from "./tax.rules";

export interface ControlAccounts {
  debtors: number;
  creditors: number;
  bank: number;
  outputVat: number;
  inputVat: number;
  defaultIncome: number;
  defaultExpense: number;
}

export function controlCodes(profile: string): ControlAccounts {
  const company = profile === "COMPANY" || profile === "company";
  const landlord = profile === "LANDLORD" || profile === "landlord";
  return {
    debtors: company ? 4200 : 1100,
    creditors: company ? 4300 : 2100,
    bank: 1200,
    outputVat: 2200,
    inputVat: 2220,
    defaultIncome: landlord ? 2000 : 1000,
    defaultExpense: 3000,
  };
}

export function requireAccount(accounts: LedgerSnapshot[], code: number, profile?: string): LedgerSnapshot {
  const account = accounts.find((item) => item.code === code && (!profile || item.profile === profile));
  if (!account) {
    throw new BookkeepingError(BK_ERR.INVALID_ACCOUNT, `Required control account ${code} is missing`);
  }
  return account;
}

export interface DocumentLineDraft {
  description: string;
  net: number;
  vat?: number;
  taxCodeId?: string | null;
  ledgerId?: string | null;
}

export function salesInvoiceLines(
  documentLines: DocumentLineDraft[],
  accounts: LedgerSnapshot[],
  taxCodes: TaxCodeSnapshot[],
  profile: string,
): { lines: DraftJournalLine[]; netTotal: number; vatTotal: number; grossTotal: number } {
  const controls = controlCodes(profile);
  const debtors = requireAccount(accounts, controls.debtors, profile);
  const outputVat = requireAccount(accounts, controls.outputVat, profile);
  const taxes = new Map(taxCodes.map((tax) => [tax.id, tax]));
  const journal: DraftJournalLine[] = [];
  let netTotal = 0;
  let vatTotal = 0;

  for (const line of documentLines) {
    const income =
      (line.ledgerId ? accounts.find((account) => account.id === line.ledgerId) : undefined) ??
      requireAccount(accounts, controls.defaultIncome, profile);
    const tax = line.taxCodeId ? taxes.get(line.taxCodeId) : undefined;
    const vat = tax ? vatOnNet(line.net, tax) : money(line.vat ?? 0);
    netTotal = money(netTotal + line.net);
    vatTotal = money(vatTotal + vat);
    journal.push({
      ledgerAccountId: income.id,
      debit: 0,
      credit: money(line.net),
      taxCodeId: line.taxCodeId,
      description: line.description,
    });
  }

  if (vatTotal > 0) {
    journal.push({
      ledgerAccountId: outputVat.id,
      debit: 0,
      credit: vatTotal,
      description: "Output VAT",
    });
  }
  journal.unshift({
    ledgerAccountId: debtors.id,
    debit: money(netTotal + vatTotal),
    credit: 0,
    description: "Trade debtors",
  });
  return { lines: journal, netTotal, vatTotal, grossTotal: money(netTotal + vatTotal) };
}

export function purchaseBillLines(
  documentLines: DocumentLineDraft[],
  accounts: LedgerSnapshot[],
  taxCodes: TaxCodeSnapshot[],
  profile: string,
): { lines: DraftJournalLine[]; netTotal: number; vatTotal: number; grossTotal: number } {
  const controls = controlCodes(profile);
  const creditors = requireAccount(accounts, controls.creditors, profile);
  const inputVat = requireAccount(accounts, controls.inputVat, profile);
  const taxes = new Map(taxCodes.map((tax) => [tax.id, tax]));
  const journal: DraftJournalLine[] = [];
  let netTotal = 0;
  let vatTotal = 0;

  for (const line of documentLines) {
    const expense =
      (line.ledgerId ? accounts.find((account) => account.id === line.ledgerId) : undefined) ??
      requireAccount(accounts, controls.defaultExpense, profile);
    const tax = line.taxCodeId ? taxes.get(line.taxCodeId) : undefined;
    const vat = tax ? vatOnNet(line.net, tax) : money(line.vat ?? 0);
    netTotal = money(netTotal + line.net);
    vatTotal = money(vatTotal + vat);
    journal.push({
      ledgerAccountId: expense.id,
      debit: money(line.net),
      credit: 0,
      taxCodeId: line.taxCodeId,
      description: line.description,
    });
  }

  if (vatTotal > 0) {
    journal.push({
      ledgerAccountId: inputVat.id,
      debit: vatTotal,
      credit: 0,
      description: "Input VAT",
    });
  }
  journal.push({
    ledgerAccountId: creditors.id,
    debit: 0,
    credit: money(netTotal + vatTotal),
    description: "Trade creditors",
  });
  return { lines: journal, netTotal, vatTotal, grossTotal: money(netTotal + vatTotal) };
}

export function bankReceiptLines(bank: LedgerSnapshot, counterpart: LedgerSnapshot, amount: number, description?: string): DraftJournalLine[] {
  const value = money(amount);
  return [
    { ledgerAccountId: bank.id, debit: value, credit: 0, description: description ?? "Bank receipt" },
    { ledgerAccountId: counterpart.id, debit: 0, credit: value, description: description ?? "Bank receipt" },
  ];
}

export function bankPaymentLines(bank: LedgerSnapshot, counterpart: LedgerSnapshot, amount: number, description?: string): DraftJournalLine[] {
  const value = money(amount);
  return [
    { ledgerAccountId: counterpart.id, debit: value, credit: 0, description: description ?? "Bank payment" },
    { ledgerAccountId: bank.id, debit: 0, credit: value, description: description ?? "Bank payment" },
  ];
}

export function dualWriteAmount(account: LedgerSnapshot, debit: number, credit: number): number {
  return signedMovement(account, debit, credit);
}
