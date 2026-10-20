import { VatReturnView, toVatReturnView } from "./vat-return.validator";

export function presentVatBoxes(view: VatReturnView) {
  return {
    box1: view.box1,
    box2: view.box2,
    box3: view.box3,
    box4: view.box4,
    box5: view.box5,
    box6: view.box6,
    box7: view.box7,
    box8: view.box8,
    box9: view.box9,
    vatDueSales: view.box1,
    vatDueAcquisitions: view.box2,
    totalVatDue: view.box3,
    vatReclaimedCurrPeriod: view.box4,
    netVatDue: Math.abs(view.box5),
    totalValueSalesExVAT: view.box6,
    totalValuePurchasesExVAT: view.box7,
    totalValueGoodsSuppliedExVAT: view.box8,
    totalAcquisitionsExVAT: view.box9,
  };
}

export function presentStoredReturn<T extends {
  vatDueSales?: unknown;
  vatDueAcquisitions?: unknown;
  totalVatDue?: unknown;
  vatReclaimedCurrPeriod?: unknown;
  netVatDue?: unknown;
  totalValueSalesExVAT?: unknown;
  totalValuePurchasesExVAT?: unknown;
  totalValueGoodsSuppliedExVAT?: unknown;
  totalAcquisitionsExVAT?: unknown;
  periodStart?: Date | string | null;
  periodEnd?: Date | string | null;
}>(row: T) {
  const view = toVatReturnView({
    vatDueSales: Number(row.vatDueSales),
    vatDueAcquisitions: Number(row.vatDueAcquisitions),
    totalVatDue: Number(row.totalVatDue),
    vatReclaimedCurrPeriod: Number(row.vatReclaimedCurrPeriod),
    netVatDue: Number(row.netVatDue),
    totalValueSalesExVAT: Number(row.totalValueSalesExVAT),
    totalValuePurchasesExVAT: Number(row.totalValuePurchasesExVAT),
    totalValueGoodsSuppliedExVAT: Number(row.totalValueGoodsSuppliedExVAT),
    totalAcquisitionsExVAT: Number(row.totalAcquisitionsExVAT),
  });
  return {
    ...row,
    ...presentVatBoxes(view),
    periodStart: row.periodStart ? toIsoDate(row.periodStart) : null,
    periodEnd: row.periodEnd ? toIsoDate(row.periodEnd) : null,
  };
}

export function toIsoDate(value: Date | string): string {
  return (value instanceof Date ? value.toISOString() : value).slice(0, 10);
}
