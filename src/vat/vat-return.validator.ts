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

export interface VatValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
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
): VatValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const boxes = normaliseBoxes(vatReturn);

  if (boxes.box3 !== round2(boxes.box1 + boxes.box2)) {
    errors.push("Box 3 must equal Box 1 + Box 2.");
  }

  const signedBox5 = round2(boxes.box3 - boxes.box4);
  if (boxes.box5 !== signedBox5 && boxes.box5 !== round2(Math.abs(signedBox5))) {
    errors.push("Box 5 must equal Box 3 - Box 4.");
  }

  for (const box of NON_NEGATIVE_BOXES) {
    if (boxes[`box${box}`] < 0) {
      errors.push(`Box ${box} cannot be negative.`);
    }
  }

  const maxOutputVat = boxes.box6 * 0.2;
  if (boxes.box1 > maxOutputVat * 1.1) {
    warnings.push("Output VAT (Box 1) appears high compared to net sales (Box 6).");
  }

  const maxInputVat = boxes.box7 * 0.2;
  if (boxes.box4 > maxInputVat * 1.1) {
    warnings.push("Input VAT (Box 4) appears high compared to net purchases (Box 7).");
  }

  if (boxes.box2 > 0 && boxes.box9 === 0) {
    warnings.push("Box 2 > 0 but Box 9 is zero – check EU acquisitions.");
  }
  if (boxes.box8 > 0 && businessProfile.region !== "NI") {
    warnings.push("Box 8 > 0 but business is not NI-based – check EU supplies.");
  }

  const allZero = ([1, 2, 3, 4, 5, 6, 7, 8, 9] as const).every((box) => boxes[`box${box}`] === 0);
  if (allZero && ledgerSummary.transactionCount > 0) {
    errors.push("Return is zero but ledger shows transactions – check mapping.");
  }

  return { valid: errors.length === 0, errors, warnings };
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

function round2(value: number): number {
  return Number(value.toFixed(2));
}
