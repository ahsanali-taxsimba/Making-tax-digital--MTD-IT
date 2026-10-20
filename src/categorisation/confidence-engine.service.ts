import { Injectable } from "@nestjs/common";
import { scoreConfidence } from "./domain/confidence";
import { ClassifyInput, HistoricalSibling, MerchantRule, ModelPrediction } from "./domain/types";
import { isRecurringAmount, looksLikeSubscription } from "./domain/scoring";

@Injectable()
export class ConfidenceEngineService {
  score(input: {
    txn: ClassifyInput;
    merchantRule: MerchantRule | null;
    model: ModelPrediction | null;
    ruleScore: number;
    winnerLedgerCode: number;
    siblings?: HistoricalSibling[];
  }) {
    const recurring =
      looksLikeSubscription(input.txn.description, input.txn.merchantName) ||
      isRecurringAmount(input.txn.amount, input.txn.merchantName, input.txn.description, input.siblings);
    return scoreConfidence(
      input.txn,
      {
        merchantRule: input.merchantRule,
        model: input.model,
        ruleScore: input.ruleScore,
        winnerLedgerCode: input.winnerLedgerCode,
        siblings: input.siblings,
      },
      recurring,
    );
  }
}
