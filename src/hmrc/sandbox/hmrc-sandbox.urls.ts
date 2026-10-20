/**
 * Canonical HMRC sandbox (test-api) and live hosts.
 *
 * Token + REST APIs live on `test-api.service.hmrc.gov.uk`. The user-restricted
 * grant screen is hosted on `test-www.tax.service.gov.uk`; some HMRC docs also
 * list `/oauth/authorize` on the API host. Both are exposed so operators can
 * pick the working authorize URL for their Developer Hub application.
 */
export const HMRC_SANDBOX_API_BASE = "https://test-api.service.hmrc.gov.uk";
export const HMRC_LIVE_API_BASE = "https://api.service.hmrc.gov.uk";
export const HMRC_SANDBOX_AUTH_BASE = "https://test-www.tax.service.gov.uk";
export const HMRC_LIVE_AUTH_BASE = "https://www.tax.service.gov.uk";

export const HMRC_SANDBOX_AUTHORIZE = `${HMRC_SANDBOX_API_BASE}/oauth/authorize`;
export const HMRC_SANDBOX_GRANT_AUTHORIZE = `${HMRC_SANDBOX_AUTH_BASE}/oauth/authorize`;
export const HMRC_SANDBOX_TOKEN = `${HMRC_SANDBOX_API_BASE}/oauth/token`;
export const HMRC_LIVE_AUTHORIZE = `${HMRC_LIVE_AUTH_BASE}/oauth/authorize`;
export const HMRC_LIVE_TOKEN = `${HMRC_LIVE_API_BASE}/oauth/token`;

export function vatObligationsPath(vrn: string): string {
  return `/organisations/vat/${vrn}/obligations`;
}

export function vatReturnsPath(vrn: string, periodKey?: string): string {
  const base = `/organisations/vat/${vrn}/returns`;
  return periodKey ? `${base}/${encodeURIComponent(periodKey)}` : base;
}

export function itsaObligationsPath(nino: string | null | undefined): string {
  return `/income-tax/${nino}/obligations`;
}

export function itsaIncomeExpensesPath(nino: string | null | undefined): string {
  return `/income-tax/${nino}/income-expenses`;
}

export function itsaUkPropertyPeriodicPath(nino: string | null | undefined): string {
  return `/income-tax/${nino}/uk-property/periodic`;
}

export function itsaUkPropertyEopsPath(nino: string | null | undefined): string {
  return `/income-tax/${nino}/uk-property/eops`;
}

export function itsaFinalDeclarationPath(nino: string | null | undefined): string {
  return `/income-tax/${nino}/calculations/final-declaration`;
}

export function sandboxUrlCatalog() {
  return {
    authorize: HMRC_SANDBOX_AUTHORIZE,
    grantAuthorize: HMRC_SANDBOX_GRANT_AUTHORIZE,
    token: HMRC_SANDBOX_TOKEN,
    apiBase: HMRC_SANDBOX_API_BASE,
    vatObligations: `${HMRC_SANDBOX_API_BASE}/organisations/vat/{vrn}/obligations`,
    vatReturns: `${HMRC_SANDBOX_API_BASE}/organisations/vat/{vrn}/returns`,
    itsaObligations: `${HMRC_SANDBOX_API_BASE}/income-tax/{nino}/obligations`,
    itsaIncomeExpenses: `${HMRC_SANDBOX_API_BASE}/income-tax/{nino}/income-expenses`,
    quarterlyUpdates: `${HMRC_SANDBOX_API_BASE}/income-tax/{nino}/uk-property/periodic`,
    eops: `${HMRC_SANDBOX_API_BASE}/income-tax/{nino}/uk-property/eops`,
    finalDeclaration: `${HMRC_SANDBOX_API_BASE}/income-tax/{nino}/calculations/final-declaration`,
    createTestUserOrganisations: `${HMRC_SANDBOX_API_BASE}/create-test-user/organisations`,
    createTestUserIndividuals: `${HMRC_SANDBOX_API_BASE}/create-test-user/individuals`,
  };
}

export function liveUrlCatalog() {
  return {
    authorize: HMRC_LIVE_AUTHORIZE,
    token: HMRC_LIVE_TOKEN,
    apiBase: HMRC_LIVE_API_BASE,
    vatObligations: `${HMRC_LIVE_API_BASE}/organisations/vat/{vrn}/obligations`,
    vatReturns: `${HMRC_LIVE_API_BASE}/organisations/vat/{vrn}/returns`,
    itsaObligations: `${HMRC_LIVE_API_BASE}/income-tax/{nino}/obligations`,
    itsaIncomeExpenses: `${HMRC_LIVE_API_BASE}/income-tax/{nino}/income-expenses`,
    quarterlyUpdates: `${HMRC_LIVE_API_BASE}/income-tax/{nino}/uk-property/periodic`,
    eops: `${HMRC_LIVE_API_BASE}/income-tax/{nino}/uk-property/eops`,
    finalDeclaration: `${HMRC_LIVE_API_BASE}/income-tax/{nino}/calculations/final-declaration`,
  };
}
