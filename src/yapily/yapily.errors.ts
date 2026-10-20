import { HttpException, HttpStatus } from "@nestjs/common";

export const YAPILY_ERR = {
  CONSENT_MISSING: "YAPILY_ERR_CONSENT_MISSING",
  CONSENT_EXPIRED: "YAPILY_ERR_CONSENT_EXPIRED",
  CONSENT_FAILED: "YAPILY_ERR_CONSENT_FAILED",
  ACCOUNT_NOT_FOUND: "YAPILY_ERR_ACCOUNT_NOT_FOUND",
  CONFIG_MISSING: "YAPILY_ERR_CONFIG_MISSING",
  REQUEST_FAILED: "YAPILY_ERR_REQUEST_FAILED",
} as const;

export type YapilyErrorCode = (typeof YAPILY_ERR)[keyof typeof YAPILY_ERR];

export class YapilyError extends HttpException {
  readonly errorCode: YapilyErrorCode;
  readonly code: YapilyErrorCode;

  constructor(errorCode: YapilyErrorCode, message: string, details?: unknown, status = HttpStatus.BAD_REQUEST) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "YapilyError";
  }
}
