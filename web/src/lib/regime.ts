export type HmrcRegime = "vat" | "itsa";

export function regimeLabel(regime: HmrcRegime): "VAT" | "ITSA" {
  return regime === "itsa" ? "ITSA" : "VAT";
}

export function regimePath(regime: HmrcRegime): "/vat" | "/itsa" {
  return regime === "itsa" ? "/itsa" : "/vat";
}

export function expiredConnectionMessage(regime: HmrcRegime = "vat"): string {
  return regime === "itsa" ? "Your HMRC ITSA connection has expired." : "Your HMRC VAT connection has expired.";
}

export const OAUTH_RETURN_TO_KEY = "mtd.oauthReturnTo";

export function regimeFromPath(path?: string | null): HmrcRegime {
  return path?.startsWith("/itsa") ? "itsa" : "vat";
}
