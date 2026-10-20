export const VAT_ISSUE_CODE = {
  VAT_ERR_ARITHMETIC: "VAT_ERR_ARITHMETIC",
  VAT_ERR_NEGATIVE: "VAT_ERR_NEGATIVE",
  VAT_ERR_PERIOD_MISMATCH: "VAT_ERR_PERIOD_MISMATCH",
  VAT_WARN_OUTPUT_VAT_HIGH: "VAT_WARN_OUTPUT_VAT_HIGH",
  VAT_WARN_INPUT_VAT_HIGH: "VAT_WARN_INPUT_VAT_HIGH",
  VAT_WARN_EU_INCONSISTENT: "VAT_WARN_EU_INCONSISTENT",
  VAT_ERR_ZERO_RETURN_INVALID: "VAT_ERR_ZERO_RETURN_INVALID",
} as const;

export type VatIssueCode = (typeof VAT_ISSUE_CODE)[keyof typeof VAT_ISSUE_CODE];

export interface VatIssue {
  code: VatIssueCode;
  severity: "error" | "warning";
  message: string;
  box?: number;
}

export interface VatReturnView {
  box1: number;
  box2: number;
  box3: number;
  box4: number;
  box5: number;
  box6: number;
  box7: number;
  box8: number;
  box9: number;
}

export interface LedgerSummary {
  transactionCount: number;
}

export interface BusinessProfile {
  region: "GB" | "NI";
}

export interface VatObligationPeriod {
  periodKey?: string;
  start: string;
  end: string;
}

export interface VatSubmittedPeriod {
  periodKey?: string;
  periodStart?: string;
  periodEnd?: string;
}

export interface VatValidationContext {
  obligation?: VatObligationPeriod | null;
  submitted?: VatSubmittedPeriod;
}

export interface VatValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: VatIssue[];
}

const NON_NEGATIVE_BOXES = [1, 2, 3, 4, 6, 7, 8, 9] as const;

export function toVatReturnView(source: {
  vatDueSales: number;
  vatDueAcquisitions: number;
  totalVatDue: number;
  vatReclaimedCurrPeriod: number;
  netVatDue: number;
  totalValueSalesExVAT: number;
  totalValuePurchasesExVAT: number;
  totalValueGoodsSuppliedExVAT: number;
  totalAcquisitionsExVAT: number;
}): VatReturnView {
  return {
    box1: source.vatDueSales,
    box2: source.vatDueAcquisitions,
    box3: source.totalVatDue,
    box4: source.vatReclaimedCurrPeriod,
    box5: source.netVatDue,
    box6: source.totalValueSalesExVAT,
    box7: source.totalValuePurchasesExVAT,
    box8: source.totalValueGoodsSuppliedExVAT,
    box9: source.totalAcquisitionsExVAT,
  };
}

export function validateVatReturn(
  vatReturn: VatReturnView,
  ledgerSummary: LedgerSummary,
  businessProfile: BusinessProfile,
  context: VatValidationContext = {},
): VatValidationResult {
  const issues: VatIssue[] = [];
  const boxes = normaliseBoxes(vatReturn);

  if (boxes.box3 !== round2(boxes.box1 + boxes.box2)) {
    issues.push({
      code: VAT_ISSUE_CODE.VAT_ERR_ARITHMETIC,
      severity: "error",
      message: "Box 3 must equal Box 1 + Box 2.",
      box: 3,
    });
  }

  const signedBox5 = round2(boxes.box3 - boxes.box4);
  if (boxes.box5 !== signedBox5 && boxes.box5 !== round2(Math.abs(signedBox5))) {
    issues.push({
      code: VAT_ISSUE_CODE.VAT_ERR_ARITHMETIC,
      severity: "error",
      message: "Box 5 must equal Box 3 - Box 4.",
      box: 5,
    });
  }

  for (const box of NON_NEGATIVE_BOXES) {
    if (boxes[`box${box}`] < 0) {
      issues.push({
        code: VAT_ISSUE_CODE.VAT_ERR_NEGATIVE,
        severity: "error",
        message: `Box ${box} cannot be negative.`,
        box,
      });
    }
  }

  if (boxes.box1 > round2(boxes.box6 * 0.2)) {
    issues.push({
      code: VAT_ISSUE_CODE.VAT_WARN_OUTPUT_VAT_HIGH,
      severity: "warning",
      message: "Output VAT (Box 1) appears high compared to net sales (Box 6).",
      box: 1,
    });
  }

  if (boxes.box4 > round2(boxes.box7 * 0.2)) {
    issues.push({
      code: VAT_ISSUE_CODE.VAT_WARN_INPUT_VAT_HIGH,
      severity: "warning",
      message: "Input VAT (Box 4) appears high compared to net purchases (Box 7).",
      box: 4,
    });
  }

  if (boxes.box2 > 0 && boxes.box9 === 0) {
    issues.push({
      code: VAT_ISSUE_CODE.VAT_WARN_EU_INCONSISTENT,
      severity: "warning",
      message: "Box 2 > 0 but Box 9 is zero – check EU acquisitions.",
      box: 2,
    });
  }
  if (boxes.box8 > 0 && businessProfile.region !== "NI") {
    issues.push({
      code: VAT_ISSUE_CODE.VAT_WARN_EU_INCONSISTENT,
      severity: "warning",
      message: "Box 8 > 0 but business is not NI-based – check EU supplies.",
      box: 8,
    });
  }

  const allZero = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).every((box) => boxes[`box${box}`] === 0);
  if (allZero && ledgerSummary.transactionCount > 0) {
    issues.push({
      code: VAT_ISSUE_CODE.VAT_ERR_ZERO_RETURN_INVALID,
      severity: "error",
      message: "Return is zero but ledger shows transactions – check mapping.",
    });
  }

  const periodIssue = periodMismatch(context.obligation, context.submitted);
  if (periodIssue) {
    issues.push(periodIssue);
  }

  const errors = issues.filter((issue) => issue.severity === "error").map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.severity === "warning").map((issue) => issue.message);
  return { valid: errors.length === 0, errors, warnings, issues };
}

function periodMismatch(
  obligation?: VatObligationPeriod | null,
  submitted?: VatSubmittedPeriod,
): VatIssue | null {
  if (!obligation || !submitted) {
    return null;
  }
  if (submitted.periodKey && obligation.periodKey && submitted.periodKey !== obligation.periodKey) {
    return {
      code: VAT_ISSUE_CODE.VAT_ERR_PERIOD_MISMATCH,
      severity: "error",
      message: `Period key ${submitted.periodKey} does not match obligation ${obligation.periodKey}.`,
    };
  }
  if (submitted.periodStart && toIsoDate(submitted.periodStart) !== toIsoDate(obligation.start)) {
    return {
      code: VAT_ISSUE_CODE.VAT_ERR_PERIOD_MISMATCH,
      severity: "error",
      message: `Period start ${toIsoDate(submitted.periodStart)} does not match obligation ${toIsoDate(obligation.start)}.`,
    };
  }
  if (submitted.periodEnd && toIsoDate(submitted.periodEnd) !== toIsoDate(obligation.end)) {
    return {
      code: VAT_ISSUE_CODE.VAT_ERR_PERIOD_MISMATCH,
      severity: "error",
      message: `Period end ${toIsoDate(submitted.periodEnd)} does not match obligation ${toIsoDate(obligation.end)}.`,
    };
  }
  return null;
}

function normaliseBoxes(vatReturn: VatReturnView): VatReturnView {
  return {
    box1: round2(vatReturn.box1),
    box2: round2(vatReturn.box2),
    box3: round2(vatReturn.box3),
    box4: round2(vatReturn.box4),
    box5: round2(vatReturn.box5),
    box6: round2(vatReturn.box6),
    box7: round2(vatReturn.box7),
    box8: round2(vatReturn.box8),
    box9: round2(vatReturn.box9),
  };
}

function toIsoDate(value: string): string {
  return value.slice(0, 10);
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}
