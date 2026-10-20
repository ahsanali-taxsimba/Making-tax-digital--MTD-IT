import { HttpException, HttpStatus } from "@nestjs/common";

export const HMRC_OAUTH_ERR = {
  INVALID_STATE: "HMRC_OAUTH_ERR_INVALID_STATE",
  TOKEN_EXCHANGE_FAILED: "HMRC_OAUTH_ERR_TOKEN_EXCHANGE_FAILED",
  REFRESH_FAILED: "HMRC_OAUTH_ERR_REFRESH_FAILED",
  CONFIG_MISSING: "HMRC_OAUTH_ERR_CONFIG_MISSING",
} as const;

export type HmrcOAuthErrorCode = (typeof HMRC_OAUTH_ERR)[keyof typeof HMRC_OAUTH_ERR];

export class HmrcOAuthError extends HttpException {
  readonly errorCode: HmrcOAuthErrorCode;
  readonly code: HmrcOAuthErrorCode;

  constructor(errorCode: HmrcOAuthErrorCode, message: string, details?: unknown, status = HttpStatus.BAD_REQUEST) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "HmrcOAuthError";
  }
}
