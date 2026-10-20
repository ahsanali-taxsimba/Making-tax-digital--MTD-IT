import { Injectable } from "@nestjs/common";
import { enrichBankLine, extractMerchant } from "../yapily/domain/enrichment";
import { cleanDescription } from "./domain/csv";

const MCC_HINTS: Array<{ match: RegExp; mcc: string }> = [
  { match: /tesco|sainsbury|asda|aldi|lidl|waitrose/i, mcc: "5411" },
  { match: /\bbp\b|shell|esso|texaco|petrol|fuel/i, mcc: "5541" },
  { match: /ads|advert|facebook|meta ads|google ads/i, mcc: "7311" },
  { match: /uber|taxi|trainline|tfl/i, mcc: "4121" },
  { match: /ee |vodafone|o2 |bt |virgin media/i, mcc: "4814" },
  { match: /fee|charge|interest|overdraft/i, mcc: "6012" },
  { match: /gallery|studio sales|receipts/i, mcc: "5999" },
];

@Injectable()
export class EnrichmentService {
  enrich(input: { description: string; type: "CREDIT" | "DEBIT"; merchantName?: string | null }) {
    const description = cleanDescription(input.description);
    const merchantName = input.merchantName?.trim() || extractMerchant(description);
    const line = enrichBankLine({
      description,
      merchantName,
      type: input.type,
    });
    const mcc = MCC_HINTS.find((rule) => rule.match.test(`${merchantName ?? ""} ${description}`))?.mcc ?? null;
    return {
      merchantName: line.merchantName,
      category: line.category,
      merchantCategoryCode: mcc,
      transactionCategory: line.category,
      vatHint: line.vatHint,
      itsaBucket: line.itsaBucket,
      description,
    };
  }
}
