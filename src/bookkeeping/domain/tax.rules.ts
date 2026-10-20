import { BookkeepingError, BK_ERR } from "../bookkeeping.errors";
import { LedgerSnapshot, TaxCodeSnapshot } from "./journal.rules";

export type { TaxCodeSnapshot };
import { money } from "./money";

export const TAX_CODE_RATES: Record<string, number> = {
  VAT_STANDARD: 20,
  VAT_REDUCED: 5,
  VAT_ZERO: 0,
  VAT_EXEMPT: 0,
  NO_VAT: 0,
};

export function vatOnNet(net: number, tax: TaxCodeSnapshot): number {
  if (tax.type === "VAT_EXEMPT" || tax.type === "NO_VAT" || tax.type === "VAT_ZERO") {
    return 0;
  }
  return money((Number(net) * Number(tax.rate)) / 100);
}

export function assertTaxCodeRate(tax: TaxCodeSnapshot): void {
  const expected = TAX_CODE_RATES[tax.type];
  if (expected === undefined) {
    throw new BookkeepingError(BK_ERR.INVALID_TAX_CODE, `Unknown tax code type ${tax.type}`, { taxCodeId: tax.id });
  }
  if (money(tax.rate) !== money(expected)) {
    throw new BookkeepingError(
      BK_ERR.INVALID_TAX_CODE,
      `Tax code ${tax.code} must use rate ${expected}% for ${tax.type}`,
      { taxCodeId: tax.id, rate: tax.rate, expected },
    );
  }
}

export function assertTaxCompatible(account: LedgerSnapshot, tax: TaxCodeSnapshot): void {
  assertTaxCodeRate(tax);
  const noVatAccount = account.code === 1070 || /exempt/i.test(account.name) || /no vat/i.test(account.name);
  if (noVatAccount && tax.type !== "VAT_EXEMPT" && tax.type !== "NO_VAT") {
    throw new BookkeepingError(BK_ERR.INVALID_TAX_CODE, `Account ${account.code} cannot carry recoverable VAT`, {
      ledgerAccountId: account.id,
      taxCodeId: tax.id,
    });
  }
  if ((tax.type === "VAT_EXEMPT" || tax.type === "NO_VAT") && money(tax.rate) !== 0) {
    throw new BookkeepingError(BK_ERR.INVALID_TAX_CODE, "Exempt and no-VAT codes must have a zero rate", {
      taxCodeId: tax.id,
    });
  }
}

export function assertJournalTaxCodes(
  lines: Array<{ taxCodeId?: string | null; ledgerAccountId: string }>,
  accounts: LedgerSnapshot[],
  taxCodes: TaxCodeSnapshot[],
): void {
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const taxesById = new Map(taxCodes.map((tax) => [tax.id, tax]));
  for (const line of lines) {
    if (!line.taxCodeId) {
      continue;
    }
    const tax = taxesById.get(line.taxCodeId);
    if (!tax) {
      throw new BookkeepingError(BK_ERR.INVALID_TAX_CODE, "Tax code does not exist", { taxCodeId: line.taxCodeId });
    }
    const account = accountsById.get(line.ledgerAccountId);
    if (account) {
      assertTaxCompatible(account, tax);
    } else {
      assertTaxCodeRate(tax);
    }
  }
}
