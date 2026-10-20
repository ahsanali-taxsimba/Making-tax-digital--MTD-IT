import { HttpException, HttpStatus } from "@nestjs/common";

export const MATCH_ERR = {
  TRANSACTION_NOT_FOUND: "MATCH_ERR_TRANSACTION_NOT_FOUND",
  SUGGESTION_NOT_FOUND: "MATCH_ERR_SUGGESTION_NOT_FOUND",
  DOCUMENT_NOT_FOUND: "MATCH_ERR_DOCUMENT_NOT_FOUND",
  ALREADY_APPLIED: "MATCH_ERR_ALREADY_APPLIED",
  ALREADY_MATCHED: "MATCH_ERR_ALREADY_MATCHED",
  ALREADY_REJECTED: "MATCH_ERR_ALREADY_REJECTED",
  KIND_MISMATCH: "MATCH_ERR_KIND_MISMATCH",
  MISSING_LEDGER: "MATCH_ERR_MISSING_LEDGER",
  NO_CANDIDATE: "MATCH_ERR_NO_CANDIDATE",
} as const;

export type MatchingErrorCode = (typeof MATCH_ERR)[keyof typeof MATCH_ERR];

export class MatchingError extends HttpException {
  readonly errorCode: MatchingErrorCode;
  readonly code: MatchingErrorCode;

  constructor(errorCode: MatchingErrorCode, message: string, details?: unknown, status = HttpStatus.BAD_REQUEST) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "MatchingError";
  }
}
