import { TaxCodeKind } from "@prisma/client";
import { LedgerSnapshot } from "../../bookkeeping/domain/journal.rules";
import { buildDraftJournal, splitGross } from "./journal-draft";

const ledger = (code: number, type: string, name: string): LedgerSnapshot => ({
  id: `L-${code}`,
  clientId: "c1",
  isActive: true,
  type,
  code,
  name,
  profile: "SOLE_TRADER",
  category: type === "INCOME" ? "Income" : type === "EXPENSE" ? "Expenses" : type === "ASSET" ? "Assets" : "VAT",
});

describe("JournalDraft", () => {
  it("splits a standard-rated payment into net, input VAT and bank", () => {
    expect(splitGross(55, 20)).toEqual({ net: 45.83, vat: 9.17, gross: 55 });
    const draft = buildDraftJournal({
      txn: { date: "2026-03-04", amount: 55, type: "DEBIT", description: "BP CONNECT BRIGHTON", merchantName: "BP" },
      counterpart: ledger(3080, "EXPENSE", "Motor Expenses"),
      bank: ledger(1200, "ASSET", "Bank"),
      tax: { id: "S", code: "S", name: "Standard", rate: 20, type: "VAT_STANDARD" },
      taxCodeKind: TaxCodeKind.VAT_STANDARD,
      inputVat: ledger(2220, "LIABILITY", "VAT on Purchases"),
    });
    expect(draft.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ledgerCode: 3080, debit: 45.83, taxCode: "S" }),
        expect.objectContaining({ ledgerCode: 2220, debit: 9.17 }),
        expect.objectContaining({ ledgerCode: 1200, credit: 55 }),
      ]),
    );
    const debits = draft.lines.reduce((sum, line) => sum + line.debit, 0);
    const credits = draft.lines.reduce((sum, line) => sum + line.credit, 0);
    expect(debits).toBe(credits);
  });

  it("posts a no-VAT receipt as bank vs income only", () => {
    const draft = buildDraftJournal({
      txn: { date: "2026-04-08", amount: 2000, type: "CREDIT", description: "Rent received" },
      counterpart: ledger(2000, "INCOME", "Residential Rent"),
      bank: ledger(1200, "ASSET", "Bank"),
      tax: { id: "NA", code: "NA", name: "No VAT", rate: 0, type: "NO_VAT" },
      taxCodeKind: TaxCodeKind.NO_VAT,
      outputVat: ledger(2200, "LIABILITY", "VAT on Sales"),
    });
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ ledgerCode: 1200, debit: 2000 }),
        expect.objectContaining({ ledgerCode: 2000, credit: 2000 }),
      ]),
    );
  });
});
