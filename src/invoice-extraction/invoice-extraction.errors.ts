import { HttpException, HttpStatus } from "@nestjs/common";

export const EXTRACT_ERR = {
  DOCUMENT_NOT_FOUND: "EXTRACT_ERR_DOCUMENT_NOT_FOUND",
  NOT_READY: "EXTRACT_ERR_NOT_READY",
  ALREADY_CONFIRMED: "EXTRACT_ERR_ALREADY_CONFIRMED",
  MISSING_FIELDS: "EXTRACT_ERR_MISSING_FIELDS",
  ALREADY_REJECTED: "EXTRACT_ERR_ALREADY_REJECTED",
} as const;

export class InvoiceExtractionError extends HttpException {
  readonly errorCode: string;
  readonly code: string;

  constructor(errorCode: string, message: string, details?: unknown, status = HttpStatus.BAD_REQUEST) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "InvoiceExtractionError";
  }
}
