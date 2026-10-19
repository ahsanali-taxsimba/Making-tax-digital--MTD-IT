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
  const code = payload.code ?? (status === 401 ? "HMRC_UNAUTHORIZED" : "HMRC_ERROR");
  const message = payload.message ?? "HMRC request failed";
  return new HmrcApiError(code, message, status, payload, correlationId);
}
