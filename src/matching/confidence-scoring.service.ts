import { Injectable } from "@nestjs/common";
import { bestDocumentMatch, rankDocumentMatches, scoreDocumentMatch } from "./domain/score";
import { BankMatchTxn, MatchableDocument, MIN_SUGGEST_CONFIDENCE, ScoredDocumentMatch, SiblingTxn } from "./domain/types";

@Injectable()
export class ConfidenceScoringService {
  score(txn: BankMatchTxn, document: MatchableDocument, siblings: SiblingTxn[] = []): ScoredDocumentMatch | null {
    return scoreDocumentMatch(txn, document, siblings);
  }

  rank(
    txn: BankMatchTxn,
    documents: MatchableDocument[],
    siblings: SiblingTxn[] = [],
    minConfidence = MIN_SUGGEST_CONFIDENCE,
  ): ScoredDocumentMatch[] {
    return rankDocumentMatches(txn, documents, siblings, minConfidence);
  }

  best(
    txn: BankMatchTxn,
    documents: MatchableDocument[],
    siblings: SiblingTxn[] = [],
    minConfidence = MIN_SUGGEST_CONFIDENCE,
  ): ScoredDocumentMatch | null {
    return bestDocumentMatch(txn, documents, siblings, minConfidence);
  }
}
