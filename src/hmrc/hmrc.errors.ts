export class HmrcApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number,
    public readonly details?: unknown,
    public readonly correlationId?: string,
  ) {
    super(message);
    this.name = "HmrcApiError";
  }
}

export function mapHmrcError(status: number, body: unknown, correlationId?: string): HmrcApiError {
  const payload = (body ?? {}) as { code?: string; message?: string; errors?: unknown };
  const mapped = status === 401 ? "HMRC_ERR_UNAUTHORISED" : status === 429 ? "HMRC_ERR_RATE_LIMIT" : status >= 500 ? "HMRC_ERR_SERVER" : status === 0 ? "HMRC_ERR_CONNECTION" : "HMRC_ERR_BAD_REQUEST";
  const code = payload.code ?? mapped;
  const message = payload.message ?? "HMRC request failed";
  return new HmrcApiError(code, message, status, payload, correlationId);
}
