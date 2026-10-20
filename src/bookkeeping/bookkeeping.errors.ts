import { HttpException, HttpStatus } from "@nestjs/common";

export const BK_ERR = {
  UNBALANCED_JOURNAL: "BK_ERR_UNBALANCED_JOURNAL",
  INVALID_ACCOUNT: "BK_ERR_INVALID_ACCOUNT",
  PERIOD_LOCKED: "BK_ERR_PERIOD_LOCKED",
  INVALID_TAX_CODE: "BK_ERR_INVALID_TAX_CODE",
} as const;

export type BookkeepingErrorCode = (typeof BK_ERR)[keyof typeof BK_ERR];

export class BookkeepingError extends HttpException {
  readonly code: BookkeepingErrorCode;

  constructor(code: BookkeepingErrorCode, message: string, details?: unknown) {
    super({ code, message, details }, HttpStatus.BAD_REQUEST);
    this.code = code;
    this.name = "BookkeepingError";
  }
}
