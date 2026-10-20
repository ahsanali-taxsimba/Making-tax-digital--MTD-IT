import { TaxCodeKind } from "@prisma/client";
import { LedgerSnapshot, TaxCodeSnapshot } from "../../bookkeeping/domain/journal.rules";
import { money, toIsoDate } from "../../bookkeeping/domain/money";
import { controlCodes, requireAccount } from "../../bookkeeping/domain/posting";
import { vatOnNet } from "../../bookkeeping/domain/tax.rules";
import { ClassifyInput, SuggestedJournal, SuggestedJournalLine } from "./types";

export function splitGross(gross: number, rate: number): { net: number; vat: number; gross: number } {
  const value = money(gross);
  if (rate <= 0) {
    return { net: value, vat: 0, gross: value };
  }
  const net = money((value * 100) / (100 + rate));
  return { net, vat: money(value - net), gross: value };
}

export function buildDraftJournal(input: {
  txn: ClassifyInput;
  counterpart: LedgerSnapshot;
  bank: LedgerSnapshot;
  tax: TaxCodeSnapshot | null;
  taxCodeKind: TaxCodeKind;
  outputVat?: LedgerSnapshot;
  inputVat?: LedgerSnapshot;
}): SuggestedJournal {
  const rate = input.tax && input.taxCodeKind !== TaxCodeKind.NO_VAT && input.taxCodeKind !== TaxCodeKind.VAT_EXEMPT ? Number(input.tax.rate) : 0;
  const split = splitGross(input.txn.amount, rate);
  const vat =
    input.tax && rate > 0
      ? vatOnNet(split.net, { id: input.tax.id, code: input.tax.code, name: input.tax.name, rate: input.tax.rate, type: input.tax.type })
      : 0;
  const net = vat > 0 ? money(split.gross - vat) : split.net;
  const vatAmount = vat > 0 ? vat : 0;
  const description = input.txn.description;
  const lines: SuggestedJournalLine[] = [];

  if (input.txn.type === "CREDIT") {
    lines.push(line(input.bank, split.gross, 0, null, "Bank receipt"));
    lines.push(line(input.counterpart, 0, net, input.tax, description));
    if (vatAmount > 0 && input.outputVat) {
      lines.push(line(input.outputVat, 0, vatAmount, null, "Output VAT"));
    }
  } else {
    lines.push(line(input.counterpart, net, 0, input.tax, description));
    if (vatAmount > 0 && input.inputVat) {
      lines.push(line(input.inputVat, vatAmount, 0, null, "Input VAT"));
    }
    lines.push(line(input.bank, 0, split.gross, null, "Bank payment"));
  }

  return {
    date: toIsoDate(input.txn.date),
    description,
    source: "BANK_FEED",
    reference: input.txn.merchantName ?? undefined,
    lines,
  };
}

export function resolveBankAndVat(ledgers: LedgerSnapshot[], profile: string) {
  const codes = controlCodes(profile);
  return {
    bank: requireAccount(ledgers, codes.bank, profile),
    outputVat: ledgers.find((item) => item.code === codes.outputVat) ?? null,
    inputVat: ledgers.find((item) => item.code === codes.inputVat) ?? null,
  };
}

function line(
  account: LedgerSnapshot,
  debit: number,
  credit: number,
  tax: TaxCodeSnapshot | null,
  description: string,
): SuggestedJournalLine {
  return {
    ledgerAccountId: account.id,
    ledgerCode: account.code,
    ledgerName: account.name,
    debit: money(debit),
    credit: money(credit),
    taxCodeId: tax?.id ?? null,
    taxCode: tax?.code ?? null,
    description,
  };
}
