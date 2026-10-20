import { HttpException, HttpStatus } from "@nestjs/common";

export const CAT_ERR = {
  TRANSACTION_NOT_FOUND: "CAT_ERR_TRANSACTION_NOT_FOUND",
  SUGGESTION_NOT_FOUND: "CAT_ERR_SUGGESTION_NOT_FOUND",
  ALREADY_APPLIED: "CAT_ERR_ALREADY_APPLIED",
  ALREADY_MATCHED: "CAT_ERR_ALREADY_MATCHED",
  MISSING_LEDGER: "CAT_ERR_MISSING_LEDGER",
} as const;

export type CategorisationErrorCode = (typeof CAT_ERR)[keyof typeof CAT_ERR];

export class CategorisationError extends HttpException {
  readonly errorCode: CategorisationErrorCode;
  readonly code: CategorisationErrorCode;

  constructor(errorCode: CategorisationErrorCode, message: string, details?: unknown, status = HttpStatus.BAD_REQUEST) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "CategorisationError";
  }
}
