import { HttpException, HttpStatus } from "@nestjs/common";

export const MANUAL_ERR = {
  FILE_TYPE: "MANUAL_ERR_FILE_TYPE",
  EMPTY_FILE: "MANUAL_ERR_EMPTY_FILE",
  PARSE_FAILED: "MANUAL_ERR_PARSE_FAILED",
  UPLOAD_NOT_FOUND: "MANUAL_ERR_UPLOAD_NOT_FOUND",
  ACCOUNT_MISMATCH: "MANUAL_ERR_ACCOUNT_MISMATCH",
} as const;

export type ManualStatementErrorCode = (typeof MANUAL_ERR)[keyof typeof MANUAL_ERR];

export class ManualStatementError extends HttpException {
  readonly errorCode: ManualStatementErrorCode;
  readonly code: ManualStatementErrorCode;

  constructor(errorCode: ManualStatementErrorCode, message: string, details?: unknown, status = HttpStatus.BAD_REQUEST) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "ManualStatementError";
  }
}
