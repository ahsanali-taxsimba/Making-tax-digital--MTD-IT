import { HttpException, HttpStatus } from "@nestjs/common";

export const HMRC_ERR = {
  TOKEN_EXPIRED: "HMRC_ERR_TOKEN_EXPIRED",
  TOKEN_REFRESH_FAILED: "HMRC_ERR_TOKEN_REFRESH_FAILED",
  UNAUTHORISED: "HMRC_ERR_UNAUTHORISED",
  INVALID_SCOPE: "HMRC_ERR_INVALID_SCOPE",
  FORBIDDEN: "HMRC_ERR_FORBIDDEN",
  NOT_FOUND: "HMRC_ERR_NOT_FOUND",
  CONFLICT: "HMRC_ERR_CONFLICT",
  RATE_LIMIT: "HMRC_ERR_RATE_LIMIT",
  SERVER: "HMRC_ERR_SERVER",
  BAD_REQUEST: "HMRC_ERR_BAD_REQUEST",
  CONNECTION: "HMRC_ERR_CONNECTION",
} as const;

export type HmrcClientErrorCode = (typeof HMRC_ERR)[keyof typeof HMRC_ERR];

export class HmrcClientError extends HttpException {
  readonly errorCode: HmrcClientErrorCode;
  readonly code: HmrcClientErrorCode;
  readonly correlationId?: string;

  constructor(
    errorCode: HmrcClientErrorCode,
    message: string,
    details?: unknown,
    status = statusFor(errorCode),
    correlationId?: string,
  ) {
    super({ errorCode, code: errorCode, message, details, correlationId }, status);
    this.errorCode = errorCode;
    this.code = errorCode;
    this.correlationId = correlationId;
    this.name = "HmrcClientError";
  }
}

export function handleHMRCError(
  response: { status: number; body?: unknown; correlationId?: string },
): HmrcClientError {
  const payload = (response.body ?? {}) as { code?: string; message?: string; error?: string; error_description?: string };
  const message = payload.message ?? payload.error_description ?? payload.error ?? "HMRC request failed";
  const blob = `${payload.code ?? ""} ${message}`.toLowerCase();
  const status = response.status;

  if (status === 0) {
    return new HmrcClientError(HMRC_ERR.CONNECTION, "Could not reach HMRC", payload, HttpStatus.BAD_GATEWAY, response.correlationId);
  }
  if (status === 401 && /expir|invalid_token|access token/.test(blob)) {
    return new HmrcClientError(HMRC_ERR.TOKEN_EXPIRED, "HMRC access token has expired", payload, 401, response.correlationId);
  }
  if (status === 401) {
    return new HmrcClientError(HMRC_ERR.UNAUTHORISED, "HMRC rejected the access token", payload, 401, response.correlationId);
  }
  if (status === 403 && /scope/.test(blob)) {
    return new HmrcClientError(HMRC_ERR.INVALID_SCOPE, "HMRC token is missing a required scope", payload, 403, response.correlationId);
  }
  if (status === 403) {
    return new HmrcClientError(HMRC_ERR.FORBIDDEN, message || "HMRC refused the request", payload, 403, response.correlationId);
  }
  if (status === 404) {
    return new HmrcClientError(HMRC_ERR.NOT_FOUND, message || "HMRC resource was not found", payload, 404, response.correlationId);
  }
  if (status === 409) {
    return new HmrcClientError(
      HMRC_ERR.CONFLICT,
      message || "HMRC rejected a duplicate submission",
      payload,
      409,
      response.correlationId,
    );
  }
  if (status === 429) {
    return new HmrcClientError(HMRC_ERR.RATE_LIMIT, "HMRC rate limit exceeded", payload, 429, response.correlationId);
  }
  if (status >= 500) {
    return new HmrcClientError(HMRC_ERR.SERVER, "HMRC is unavailable", payload, HttpStatus.BAD_GATEWAY, response.correlationId);
  }
  return new HmrcClientError(HMRC_ERR.BAD_REQUEST, message, payload, status >= 400 ? status : 400, response.correlationId);
}

function statusFor(code: HmrcClientErrorCode): number {
  switch (code) {
    case HMRC_ERR.TOKEN_EXPIRED:
    case HMRC_ERR.UNAUTHORISED:
      return 401;
    case HMRC_ERR.INVALID_SCOPE:
    case HMRC_ERR.FORBIDDEN:
      return 403;
    case HMRC_ERR.NOT_FOUND:
      return 404;
    case HMRC_ERR.CONFLICT:
      return 409;
    case HMRC_ERR.RATE_LIMIT:
      return 429;
    case HMRC_ERR.SERVER:
    case HMRC_ERR.CONNECTION:
    case HMRC_ERR.TOKEN_REFRESH_FAILED:
      return HttpStatus.BAD_GATEWAY;
    default:
      return 400;
  }
}
