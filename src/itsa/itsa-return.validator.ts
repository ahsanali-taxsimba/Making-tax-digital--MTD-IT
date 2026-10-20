import { ChartProfile } from "@prisma/client";
import { itsaKeySets } from "./mtd-itsa.mapping";

export const ITSA_ISSUE_CODE = {
  ITSA_ERR_PERIOD_MISMATCH: "ITSA_ERR_PERIOD_MISMATCH",
  ITSA_ERR_INVALID_CATEGORY: "ITSA_ERR_INVALID_CATEGORY",
  ITSA_ERR_CAPITAL_ITEM_INCLUDED: "ITSA_ERR_CAPITAL_ITEM_INCLUDED",
  ITSA_ERR_ZERO_UPDATE_INVALID: "ITSA_ERR_ZERO_UPDATE_INVALID",
  ITSA_ERR_MISSING_EOPS: "ITSA_ERR_MISSING_EOPS",
  ITSA_ERR_MISSING_FINAL_DECLARATION: "ITSA_ERR_MISSING_FINAL_DECLARATION",
} as const;

export type ItsaIssueCode = (typeof ITSA_ISSUE_CODE)[keyof typeof ITSA_ISSUE_CODE];

export interface ItsaIssue {
  code: ItsaIssueCode;
  severity: "error" | "warning";
  message: string;
  category?: string;
  businessId?: string;
}

export interface ItsaValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: ItsaIssue[];
}

export interface ItsaObligationPeriod {
  periodId?: string | null;
  start: string;
  end: string;
}

export interface ItsaQuarterlyPayload {
  incomes: Record<string, number>;
  expenses: Record<string, number>;
  transactionCount: number;
  excluded?: Array<{ reason: string; amount: number; category?: string }>;
}

export function validateItsaQuarterlyUpdate(
  payload: ItsaQuarterlyPayload,
  profile: ChartProfile,
  context: { obligation?: ItsaObligationPeriod | null; submitted?: { periodId?: string; periodStart?: string; periodEnd?: string } } = {},
): ItsaValidationResult {
  const issues: ItsaIssue[] = [];
  const keys = itsaKeySets(profile);
  const incomes = payload.incomes ?? {};
  const expenses = payload.expenses ?? {};

  for (const [category, amount] of Object.entries(incomes)) {
    classifyKey(category, amount, "income", keys, issues);
  }
  for (const [category, amount] of Object.entries(expenses)) {
    classifyKey(category, amount, "expense", keys, issues);
  }

  const allZero =
    Object.values(incomes).every((value) => Number(value) === 0) &&
    Object.values(expenses).every((value) => Number(value) === 0);
  if (allZero && payload.transactionCount > 0) {
    issues.push({
      code: ITSA_ISSUE_CODE.ITSA_ERR_ZERO_UPDATE_INVALID,
      severity: "error",
      message: "Quarterly update is zero but the ledger has transactions – check mapping.",
    });
  }

  const periodIssue = periodMismatch(context.obligation, context.submitted);
  if (periodIssue) {
    issues.push(periodIssue);
  }

  return pack(issues);
}

export function validateItsaEops(input: {
  businessId: string;
  taxYear: string;
  quarterlyUpdateCount: number;
}): ItsaValidationResult {
  const issues: ItsaIssue[] = [];
  if (input.quarterlyUpdateCount < 1) {
    issues.push({
      code: ITSA_ISSUE_CODE.ITSA_ERR_PERIOD_MISMATCH,
      severity: "error",
      message: `EOPS for ${input.taxYear} has no quarterly updates for this business.`,
      businessId: input.businessId,
    });
  }
  return pack(issues);
}

export function validateItsaYear(input: {
  taxYear: string;
  businesses: Array<{ id: string; tradingName: string }>;
  eopsBusinessIds: string[];
  hasFinalDeclaration: boolean;
}): ItsaValidationResult {
  const issues: ItsaIssue[] = [];
  for (const business of input.businesses) {
    if (!input.eopsBusinessIds.includes(business.id)) {
      issues.push({
        code: ITSA_ISSUE_CODE.ITSA_ERR_MISSING_EOPS,
        severity: "error",
        message: `Missing EOPS for ${business.tradingName} in ${input.taxYear}.`,
        businessId: business.id,
      });
    }
  }
  if (input.businesses.length > 0 && !input.hasFinalDeclaration && issues.length === 0) {
    issues.push({
      code: ITSA_ISSUE_CODE.ITSA_ERR_MISSING_FINAL_DECLARATION,
      severity: "error",
      message: `Final declaration has not been submitted for ${input.taxYear}.`,
    });
  }
  return pack(issues);
}

export function validateItsaFinalDeclaration(input: {
  taxYear: string;
  businesses: Array<{ id: string; tradingName: string }>;
  eopsBusinessIds: string[];
}): ItsaValidationResult {
  const issues: ItsaIssue[] = [];
  for (const business of input.businesses) {
    if (!input.eopsBusinessIds.includes(business.id)) {
      issues.push({
        code: ITSA_ISSUE_CODE.ITSA_ERR_MISSING_EOPS,
        severity: "error",
        message: `Cannot submit the final declaration until EOPS is filed for ${business.tradingName}.`,
        businessId: business.id,
      });
    }
  }
  return pack(issues);
}

function classifyKey(
  category: string,
  amount: number,
  expected: "income" | "expense",
  keys: ReturnType<typeof itsaKeySets>,
  issues: ItsaIssue[],
) {
  if (keys.capital.has(category) && amount !== 0) {
    issues.push({
      code: ITSA_ISSUE_CODE.ITSA_ERR_CAPITAL_ITEM_INCLUDED,
      severity: "error",
      message: `Capital item '${category}' cannot be included in a quarterly update.`,
      category,
    });
    return;
  }
  if (keys.disallowable.has(category) && amount !== 0) {
    issues.push({
      code: ITSA_ISSUE_CODE.ITSA_ERR_INVALID_CATEGORY,
      severity: "error",
      message: `Disallowable category '${category}' cannot be included in a quarterly update.`,
      category,
    });
    return;
  }
  const allowed = expected === "income" ? keys.income : keys.expense;
  if (!allowed.has(category) && !keys.capital.has(category) && !keys.disallowable.has(category)) {
    issues.push({
      code: ITSA_ISSUE_CODE.ITSA_ERR_INVALID_CATEGORY,
      severity: "error",
      message: `Unknown HMRC ${expected} category '${category}'.`,
      category,
    });
  }
}

function periodMismatch(
  obligation?: ItsaObligationPeriod | null,
  submitted?: { periodId?: string; periodStart?: string; periodEnd?: string },
): ItsaIssue | null {
  if (!obligation || !submitted) {
    return null;
  }
  if (submitted.periodId && obligation.periodId && submitted.periodId !== obligation.periodId) {
    return {
      code: ITSA_ISSUE_CODE.ITSA_ERR_PERIOD_MISMATCH,
      severity: "error",
      message: `Period ${submitted.periodId} does not match obligation ${obligation.periodId}.`,
    };
  }
  if (submitted.periodStart && submitted.periodStart.slice(0, 10) !== obligation.start.slice(0, 10)) {
    return {
      code: ITSA_ISSUE_CODE.ITSA_ERR_PERIOD_MISMATCH,
      severity: "error",
      message: `Period start ${submitted.periodStart.slice(0, 10)} does not match obligation ${obligation.start.slice(0, 10)}.`,
    };
  }
  if (submitted.periodEnd && submitted.periodEnd.slice(0, 10) !== obligation.end.slice(0, 10)) {
    return {
      code: ITSA_ISSUE_CODE.ITSA_ERR_PERIOD_MISMATCH,
      severity: "error",
      message: `Period end ${submitted.periodEnd.slice(0, 10)} does not match obligation ${obligation.end.slice(0, 10)}.`,
    };
  }
  return null;
}

function pack(issues: ItsaIssue[]): ItsaValidationResult {
  const errors = issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message);
  return { valid: errors.length === 0, errors, warnings, issues };
}
