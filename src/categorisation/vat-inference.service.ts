import { Injectable } from "@nestjs/common";
import { TaxCodeKind } from "@prisma/client";
import { inferTaxCodeKind, taxKindRate, taxKindToCode } from "./domain/vat.inference";
import { ClassifyInput, MerchantRule, MccRule } from "./domain/types";

@Injectable()
export class VATInferenceService {
  infer(input: {
    type: ClassifyInput["type"];
    merchantCategoryCode?: string | null;
    merchantRule?: MerchantRule | null;
    mccRule?: MccRule | null;
    transactionCategory?: string | null;
    description?: string;
  }): TaxCodeKind {
    return inferTaxCodeKind(input);
  }

  codeFor(kind: TaxCodeKind): string {
    return taxKindToCode(kind);
  }

  rateFor(kind: TaxCodeKind): number {
    return taxKindRate(kind);
  }
}
