import { HttpException, HttpStatus } from "@nestjs/common";

export const AUTHZ_ERR = {
  DENIED: "AUTHZ_ERR_DENIED",
  CROSS_FIRM: "AUTHZ_ERR_CROSS_FIRM",
  PLATFORM_CLIENT_DATA: "AUTHZ_ERR_PLATFORM_CLIENT_DATA",
  CLIENT_SCOPE: "AUTHZ_ERR_CLIENT_SCOPE",
} as const;

export class AuthorizationError extends HttpException {
  readonly errorCode: string;
  readonly code: string;

  constructor(errorCode: string, message: string, details?: unknown, status = HttpStatus.FORBIDDEN) {
    super({ errorCode, code: errorCode, message, details }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.name = "AuthorizationError";
  }
}
