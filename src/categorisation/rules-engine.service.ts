import { Injectable } from "@nestjs/common";
import { ChartProfile, TaxCodeKind } from "@prisma/client";
import { flattenItsaCatalog } from "../itsa/mtd-itsa.mapping";
import { ClassifyInput } from "./domain/types";
import { ITSAInferenceService } from "./itsa-inference.service";
import { MCCMappingService } from "./mcc-mapping.service";
import { MerchantDictionaryService } from "./merchant-dictionary.service";
import { VATInferenceService } from "./vat-inference.service";

@Injectable()
export class RulesEngineService {
  constructor(
    private readonly merchants: MerchantDictionaryService,
    private readonly mcc: MCCMappingService,
    private readonly vat: VATInferenceService,
    private readonly itsa: ITSAInferenceService,
  ) {}

  async evaluate(input: ClassifyInput, profile: ChartProfile = ChartProfile.SOLE_TRADER, ledgerCode?: number) {
    const merchant = await this.merchants.lookup(input.merchantName ?? input.ocrMerchantName, `${input.description} ${input.ocrText ?? ""}`);
    const mccRule = await this.mcc.lookup(input.merchantCategoryCode);
    const taxCodeKind = this.vat.infer({
      type: input.type,
      merchantCategoryCode: input.merchantCategoryCode,
      merchantRule: merchant,
      mccRule,
      transactionCategory: input.transactionCategory ?? input.category,
      description: `${input.description} ${input.ocrText ?? ""}`,
      ocrVatRate: input.ocrVatRate,
      ocrVatAmount: input.ocrVatAmount,
    });
    const mappedLedger = ledgerCode ?? merchant?.ledgerCode ?? mccRule?.ledgerCode;
    return {
      merchant,
      mcc: mccRule,
      taxCodeKind,
      taxCode: this.vat.codeFor(taxCodeKind),
      itsa: mappedLedger != null ? this.itsa.infer(profile, mappedLedger) : null,
    };
  }

  async catalog() {
    const [merchants, mcc] = await Promise.all([this.merchants.list(), this.mcc.list()]);
    return {
      merchants,
      mcc,
      vat: {
        standardWhenVatableMcc: true,
        noVatWhenExemptMcc: true,
        standardCode: this.vat.codeFor(TaxCodeKind.VAT_STANDARD),
        reducedCode: this.vat.codeFor(TaxCodeKind.VAT_REDUCED),
        noVatCode: this.vat.codeFor(TaxCodeKind.NO_VAT),
        rates: [0, 5, 20],
        vatableMccs: mcc.filter((rule) => rule.vatable).map((rule) => rule.mcc),
        exemptMccs: mcc.filter((rule) => !rule.vatable).map((rule) => rule.mcc),
      },
      itsa: flattenItsaCatalog().map((row) => ({
        profile: row.profile,
        ledgerCode: row.code,
        category: row.category,
        bucket: row.bucket,
        hmrcKey: row.hmrcKey,
        includedInQuarterlyUpdate: row.includedInQuarterlyUpdate,
      })),
      amountPatterns: ["recurring_subscription", "invoice_credit", "bill_debit", "ocr_gross_match"],
    };
  }
}
