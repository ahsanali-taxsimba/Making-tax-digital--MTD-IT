import { HmrcClientError, HMRC_ERR } from "../client/hmrc-client.errors";
import { EopsPayload, FinalDeclarationPayload, QuarterlyUpdatePayload, VatReturnBoxes } from "../hmrc.types";

export interface SchemaIssue {
  path: string;
  message: string;
}

function fail(issues: SchemaIssue[]): never {
  throw new HmrcClientError(HMRC_ERR.BAD_REQUEST, "HMRC payload failed schema validation", { issues });
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isMoney(value: unknown): boolean {
  if (!isNumber(value)) return false;
  return Math.round(value * 100) === value * 100 || Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;
}

function isWholePounds(value: unknown): boolean {
  return isNumber(value) && Number.isInteger(value);
}

function isDate(value: unknown): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isTaxYear(value: unknown): boolean {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value);
}

/**
 * VAT (MTD) 1.0 submit VAT return body.
 * https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-api
 */
export function validateVatReturnPayload(body: unknown): VatReturnBoxes {
  const payload = (body ?? {}) as Record<string, unknown>;
  const issues: SchemaIssue[] = [];
  if (typeof payload.periodKey !== "string" || !payload.periodKey) {
    issues.push({ path: "periodKey", message: "periodKey is required" });
  }
  const moneyFields = [
    "vatDueSales",
    "vatDueAcquisitions",
    "totalVatDue",
    "vatReclaimedCurrPeriod",
    "netVatDue",
  ] as const;
  for (const field of moneyFields) {
    if (!isMoney(payload[field])) {
      issues.push({ path: field, message: `${field} must be a number with at most 2 decimal places` });
    }
  }
  const poundFields = [
    "totalValueSalesExVAT",
    "totalValuePurchasesExVAT",
    "totalValueGoodsSuppliedExVAT",
    "totalAcquisitionsExVAT",
  ] as const;
  for (const field of poundFields) {
    if (!isWholePounds(payload[field])) {
      issues.push({ path: field, message: `${field} must be a whole-pound integer` });
    }
  }
  if (payload.finalised !== true) {
    issues.push({ path: "finalised", message: "HMRC requires finalised=true on a VAT return submission" });
  }
  if (isMoney(payload.vatDueSales) && isMoney(payload.vatDueAcquisitions) && isMoney(payload.totalVatDue)) {
    const expected = Number((Number(payload.vatDueSales) + Number(payload.vatDueAcquisitions)).toFixed(2));
    if (expected !== Number(payload.totalVatDue)) {
      issues.push({ path: "totalVatDue", message: "totalVatDue must equal vatDueSales + vatDueAcquisitions" });
    }
  }
  if (issues.length) fail(issues);
  return payload as unknown as VatReturnBoxes;
}

/**
 * ITSA quarterly / UK property periodic update. Accepts the platform facade
 * `{ incomes, expenses, periodStart, periodEnd, taxYear, businessId }` and
 * the official HMRC `{ periodDates, periodIncome, periodExpenses }` shape.
 */
export function validateQuarterlyUpdatePayload(body: unknown): QuarterlyUpdatePayload {
  const payload = (body ?? {}) as Record<string, unknown>;
  const issues: SchemaIssue[] = [];
  if (typeof payload.businessId !== "string" || !payload.businessId) {
    issues.push({ path: "businessId", message: "businessId is required" });
  }
  if (!isTaxYear(payload.taxYear)) {
    issues.push({ path: "taxYear", message: "taxYear must look like 2025-26" });
  }
  const start = payload.periodStart ?? (payload.periodDates as { periodStartDate?: string } | undefined)?.periodStartDate;
  const end = payload.periodEnd ?? (payload.periodDates as { periodEndDate?: string } | undefined)?.periodEndDate;
  if (!isDate(start)) issues.push({ path: "periodStart", message: "periodStart must be YYYY-MM-DD" });
  if (!isDate(end)) issues.push({ path: "periodEnd", message: "periodEnd must be YYYY-MM-DD" });
  const incomes = (payload.incomes ?? payload.periodIncome ?? {}) as Record<string, unknown>;
  const expenses = (payload.expenses ?? payload.periodExpenses ?? {}) as Record<string, unknown>;
  if (!incomes || typeof incomes !== "object") {
    issues.push({ path: "incomes", message: "incomes / periodIncome is required" });
  } else {
    for (const [key, value] of Object.entries(incomes)) {
      if (!isMoney(value) && !isNumber(value)) {
        issues.push({ path: `incomes.${key}`, message: "amount must be numeric" });
      }
    }
  }
  if (expenses && typeof expenses === "object") {
    for (const [key, value] of Object.entries(expenses)) {
      if (!isMoney(value) && !isNumber(value)) {
        issues.push({ path: `expenses.${key}`, message: "amount must be numeric" });
      }
    }
  }
  if (issues.length) fail(issues);
  return {
    businessId: String(payload.businessId),
    taxYear: String(payload.taxYear),
    periodId: String(payload.periodId ?? ""),
    periodStart: String(start),
    periodEnd: String(end),
    incomes: incomes as Record<string, number>,
    expenses: (expenses ?? {}) as Record<string, number>,
    typeOfBusiness: typeof payload.typeOfBusiness === "string" ? payload.typeOfBusiness : undefined,
  };
}

export function validateEopsPayload(body: unknown): EopsPayload {
  const payload = (body ?? {}) as Record<string, unknown>;
  const issues: SchemaIssue[] = [];
  if (typeof payload.businessId !== "string" || !payload.businessId) {
    issues.push({ path: "businessId", message: "businessId is required" });
  }
  if (!isTaxYear(payload.taxYear)) {
    issues.push({ path: "taxYear", message: "taxYear must look like 2025-26" });
  }
  if (typeof payload.typeOfBusiness !== "string" || !payload.typeOfBusiness) {
    issues.push({ path: "typeOfBusiness", message: "typeOfBusiness is required" });
  }
  const start = payload.accountingPeriodStart ?? (payload.accountingPeriod as { startDate?: string } | undefined)?.startDate;
  const end = payload.accountingPeriodEnd ?? (payload.accountingPeriod as { endDate?: string } | undefined)?.endDate;
  if (!isDate(start)) issues.push({ path: "accountingPeriodStart", message: "accountingPeriodStart must be YYYY-MM-DD" });
  if (!isDate(end)) issues.push({ path: "accountingPeriodEnd", message: "accountingPeriodEnd must be YYYY-MM-DD" });
  if (payload.finalised !== true) {
    issues.push({ path: "finalised", message: "HMRC requires finalised=true on EOPS" });
  }
  if (issues.length) fail(issues);
  return {
    businessId: String(payload.businessId),
    taxYear: String(payload.taxYear),
    typeOfBusiness: String(payload.typeOfBusiness),
    accountingPeriodStart: String(start),
    accountingPeriodEnd: String(end),
    finalised: true,
  };
}

export function validateFinalDeclarationPayload(body: unknown): FinalDeclarationPayload {
  const payload = (body ?? {}) as Record<string, unknown>;
  const issues: SchemaIssue[] = [];
  if (!isTaxYear(payload.taxYear)) {
    issues.push({ path: "taxYear", message: "taxYear must look like 2025-26" });
  }
  if (payload.finalised !== true) {
    issues.push({ path: "finalised", message: "HMRC requires finalised=true on a Final Declaration" });
  }
  if (issues.length) fail(issues);
  return {
    taxYear: String(payload.taxYear),
    calculationId: typeof payload.calculationId === "string" ? payload.calculationId : undefined,
    finalised: true,
  };
}

export function looksLikeVatReturnPath(path: string): boolean {
  return /\/organisations\/vat\/[^/]+\/returns$/.test(path.split("?")[0]);
}

export function looksLikeQuarterlyPath(path: string): boolean {
  const clean = path.split("?")[0];
  return /\/income-tax\/[^/]+\/(updates|uk-property\/periodic)$/.test(clean);
}

export function looksLikeEopsPath(path: string): boolean {
  const clean = path.split("?")[0];
  return /\/income-tax\/[^/]+\/(eops|uk-property\/eops)$/.test(clean);
}

export function looksLikeFinalDeclarationPath(path: string): boolean {
  const clean = path.split("?")[0];
  return /\/income-tax\/[^/]+\/(final-declaration|calculations\/final-declaration)$/.test(clean);
}

export function validateHmrcBody(method: string, path: string, body: unknown): unknown {
  if (method === "GET" || body == null) {
    return body;
  }
  if (looksLikeVatReturnPath(path) && (method === "POST" || method === "PUT")) {
    return validateVatReturnPayload(body);
  }
  if (looksLikeQuarterlyPath(path) && (method === "POST" || method === "PUT")) {
    return validateQuarterlyUpdatePayload(body);
  }
  if (looksLikeEopsPath(path) && (method === "POST" || method === "PUT")) {
    return validateEopsPayload(body);
  }
  if (looksLikeFinalDeclarationPath(path) && (method === "POST" || method === "PUT")) {
    return validateFinalDeclarationPayload(body);
  }
  return body;
}
