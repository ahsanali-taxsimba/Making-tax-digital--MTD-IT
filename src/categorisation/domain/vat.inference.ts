import { TaxCodeKind } from "@prisma/client";
import { isExemptMcc, isVatableMcc, matchMcc } from "./mcc.mapping";
import { ClassifyInput, MerchantRule, MccRule } from "./types";

export function inferTaxCodeKind(input: {
  type: ClassifyInput["type"];
  merchantCategoryCode?: string | null;
  merchantRule?: MerchantRule | null;
  mccRule?: MccRule | null;
  transactionCategory?: string | null;
  description?: string;
}): TaxCodeKind {
  if (input.merchantRule?.taxCodeKind) {
    return input.merchantRule.taxCodeKind;
  }
  if (input.mccRule?.taxCodeKind) {
    return input.mccRule.taxCodeKind;
  }
  if (isExemptMcc(input.merchantCategoryCode)) {
    return TaxCodeKind.NO_VAT;
  }
  if (isVatableMcc(input.merchantCategoryCode) || matchMcc(input.merchantCategoryCode)?.vatable) {
    return TaxCodeKind.VAT_STANDARD;
  }
  const haystack = `${input.transactionCategory ?? ""} ${input.description ?? ""}`.toLowerCase();
  if (/\b(fee|charge|interest|insurance|exempt|no vat|nino|hmrc|tax)\b/.test(haystack)) {
    return TaxCodeKind.NO_VAT;
  }
  if (input.type === "CREDIT") {
    return TaxCodeKind.VAT_STANDARD;
  }
  return TaxCodeKind.NO_VAT;
}

export function taxKindToCode(kind: TaxCodeKind): string {
  switch (kind) {
    case TaxCodeKind.VAT_STANDARD:
      return "S";
    case TaxCodeKind.VAT_REDUCED:
      return "R";
    case TaxCodeKind.VAT_ZERO:
      return "Z";
    case TaxCodeKind.VAT_EXEMPT:
      return "E";
    default:
      return "NA";
  }
}

export function taxKindRate(kind: TaxCodeKind): number {
  switch (kind) {
    case TaxCodeKind.VAT_STANDARD:
      return 20;
    case TaxCodeKind.VAT_REDUCED:
      return 5;
    default:
      return 0;
  }
}
