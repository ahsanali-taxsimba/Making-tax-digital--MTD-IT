import { HttpException, HttpStatus } from "@nestjs/common";

export const DOC_ERR = {
  FILE_TYPE: "DOC_ERR_FILE_TYPE",
  FILE_TOO_LARGE: "DOC_ERR_FILE_TOO_LARGE",
  EMPTY_FILE: "DOC_ERR_EMPTY_FILE",
  NOT_FOUND: "DOC_ERR_NOT_FOUND",
  TARGET_NOT_FOUND: "DOC_ERR_TARGET_NOT_FOUND",
  STORAGE_FAILED: "DOC_ERR_STORAGE_FAILED",
  INVALID_TYPE: "DOC_ERR_INVALID_TYPE",
} as const;

export type DocumentErrorCode = (typeof DOC_ERR)[keyof typeof DOC_ERR];

export class DocumentError extends HttpException {
  readonly errorCode: DocumentErrorCode;
  readonly code: DocumentErrorCode;

  constructor(errorCode: DocumentErrorCode, message: string, details?: unknown, status = HttpStatus.BAD_REQUEST) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "DocumentError";
  }
}
