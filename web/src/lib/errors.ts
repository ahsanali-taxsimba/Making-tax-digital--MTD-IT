const EXPIRED = new Set(["HMRC_ERR_TOKEN_EXPIRED"]);
const REFRESH = new Set(["HMRC_ERR_TOKEN_REFRESH_FAILED", "HMRC_OAUTH_ERR_REFRESH_FAILED"]);
const AUTHORISE = new Set([
  "HMRC_OAUTH_ERR_TOKEN_EXCHANGE_FAILED",
  "HMRC_OAUTH_ERR_INVALID_STATE",
  "HMRC_ERR_UNAUTHORISED",
  "HMRC_ERR_INVALID_SCOPE",
]);

export function hmrcUserMessage(code?: string, fallback?: string): string {
  if (!code) {
    return fallback || "Something went wrong. Please try again.";
  }
  if (EXPIRED.has(code) || /expired/i.test(code)) {
    return "Your HMRC VAT connection has expired.";
  }
  if (REFRESH.has(code) || /refresh/i.test(code)) {
    return "Unable to refresh HMRC token.";
  }
  if (AUTHORISE.has(code) || /oauth|authoris|authoriz|invalid_state/i.test(code)) {
    return "HMRC returned an error during authorisation.";
  }
  return fallback || "HMRC returned an error during authorisation.";
}

export function errorCodeOf(error: { code?: string; errorCode?: string } | null | undefined): string | undefined {
  return error?.errorCode || error?.code;
}
