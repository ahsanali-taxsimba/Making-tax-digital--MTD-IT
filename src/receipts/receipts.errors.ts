import { HttpException, HttpStatus } from "@nestjs/common";

export const RECEIPT_ERR = {
  FILE_TYPE: "RECEIPT_ERR_FILE_TYPE",
  FILE_TOO_LARGE: "RECEIPT_ERR_FILE_TOO_LARGE",
  EMPTY_FILE: "RECEIPT_ERR_EMPTY_FILE",
  NOT_FOUND: "RECEIPT_ERR_NOT_FOUND",
  TARGET_NOT_FOUND: "RECEIPT_ERR_TARGET_NOT_FOUND",
  STORAGE_FAILED: "RECEIPT_ERR_STORAGE_FAILED",
} as const;

export type ReceiptErrorCode = (typeof RECEIPT_ERR)[keyof typeof RECEIPT_ERR];

export class ReceiptError extends HttpException {
  readonly errorCode: ReceiptErrorCode;
  readonly code: ReceiptErrorCode;

  constructor(errorCode: ReceiptErrorCode, message: string, details?: unknown, status = HttpStatus.BAD_REQUEST) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "ReceiptError";
  }
}
