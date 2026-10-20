import { EopsPayload, FinalDeclarationPayload, QuarterlyUpdatePayload } from "../hmrc.types";

export interface LiveCall {
  method?: string;
  path: string;
  accept?: string;
  body?: unknown;
}

const INCOME_TAX =
  /^\/income-tax\/([^/]+)\/(obligations|updates|eops|final-declaration|income-expenses|uk-property\/periodic|uk-property\/eops|calculations\/final-declaration)$/;

export function isPropertyBusiness(value?: string | null): boolean {
  return /property|uk-property|landlord/i.test(String(value ?? ""));
}

export function expandLiveCalls(method: string, url: string, body?: unknown): LiveCall[] | null {
  const path = url.split("?")[0];
  const match = INCOME_TAX.exec(path);
  if (!match) {
    return null;
  }
  const nino = match[1];
  const action = match[2];
  if (method === "GET" && action === "obligations") {
    return [
      { path: `/obligations/details/${nino}/income-and-expenditure`, accept: "application/vnd.hmrc.2.0+json" },
      { path: `/obligations/details/${nino}/eops`, accept: "application/vnd.hmrc.2.0+json" },
      { path: `/obligations/details/${nino}/crystallisation`, accept: "application/vnd.hmrc.2.0+json" },
    ];
  }
  if (method === "GET" && action === "income-expenses") {
    return [{ path: `/obligations/details/${nino}/income-and-expenditure`, accept: "application/vnd.hmrc.2.0+json" }];
  }
  if ((method === "POST" || method === "PUT") && (action === "updates" || action === "uk-property/periodic")) {
    return [quarterlyCall(nino, body as QuarterlyUpdatePayload, action === "uk-property/periodic")];
  }
  if ((method === "POST" || method === "PUT") && (action === "eops" || action === "uk-property/eops")) {
    const payload = body as EopsPayload;
    return [
      {
        method: "POST",
        path: `/individuals/business/end-of-period-statement/nino/${nino}/${payload.businessId}/${payload.taxYear}`,
        accept: "application/vnd.hmrc.3.0+json",
        body: {
          typeOfBusiness: payload.typeOfBusiness,
          accountingPeriod: { startDate: payload.accountingPeriodStart, endDate: payload.accountingPeriodEnd },
          finalised: payload.finalised,
        },
      },
    ];
  }
  if (
    (method === "POST" || method === "PUT") &&
    (action === "final-declaration" || action === "calculations/final-declaration")
  ) {
    const payload = body as FinalDeclarationPayload;
    return [
      {
        method: "POST",
        path: `/individuals/calculations/${nino}/self-assessment/${payload.taxYear}/final-declaration`,
        accept: "application/vnd.hmrc.5.0+json",
        body: { finalised: payload.finalised, calculationId: payload.calculationId },
      },
    ];
  }
  return null;
}

function quarterlyCall(nino: string, payload: QuarterlyUpdatePayload, forceProperty: boolean): LiveCall {
  const property = forceProperty || isPropertyBusiness(payload.typeOfBusiness);
  if (property) {
    const periodId = payload.periodId || `${payload.periodStart}_${payload.periodEnd}`;
    return {
      method: "PUT",
      path: `/individuals/business/property/uk/${nino}/${payload.businessId}/${payload.taxYear}/${periodId}`,
      accept: "application/vnd.hmrc.5.0+json",
      body: {
        ukProperty: {
          income: toUkPropertyIncome(payload.incomes),
          expenses: toUkPropertyExpenses(payload.expenses),
        },
      },
    };
  }
  return {
    method: "PUT",
    path: `/individuals/business/self-employment/${nino}/${payload.businessId}/period/${payload.taxYear}`,
    accept: "application/vnd.hmrc.5.0+json",
    body: {
      periodDates: { periodStartDate: payload.periodStart, periodEndDate: payload.periodEnd },
      periodIncome: payload.incomes,
      periodExpenses: payload.expenses,
    },
  };
}

function pick(source: Record<string, number> | undefined, keys: string[]): number | undefined {
  if (!source) return undefined;
  for (const key of keys) {
    if (source[key] != null) return source[key];
  }
  return undefined;
}

export function toUkPropertyIncome(incomes: Record<string, number> = {}) {
  return {
    periodAmount: pick(incomes, ["periodAmount", "turnover", "ukPropertyIncome", "propertyIncome", "rentsReceived"]) ?? 0,
    premiumsOfLeaseGrant: pick(incomes, ["premiumsOfLeaseGrant"]) ?? 0,
    reversePremiums: pick(incomes, ["reversePremiums"]) ?? 0,
    otherIncome: pick(incomes, ["otherIncome", "otherPropertyIncome"]) ?? 0,
    taxDeducted: pick(incomes, ["taxDeducted"]) ?? 0,
    rentARoom: { rentsReceived: pick(incomes, ["rentsReceived", "rentARoom"]) ?? 0 },
  };
}

export function toUkPropertyExpenses(expenses: Record<string, number> = {}) {
  return {
    premisesRunningCosts: pick(expenses, ["premisesRunningCosts", "rentRatesPowerAndInsuranceCosts", "councilTax", "groundRent"]) ?? 0,
    repairsAndMaintenance: pick(expenses, ["repairsAndMaintenance", "propertyRepairsAndMaintenance"]) ?? 0,
    financialCosts: pick(expenses, ["financialCosts", "loanInterestRestricted", "residentialFinancialCost"]) ?? 0,
    professionalFees: pick(expenses, ["professionalFees", "agentFees", "legalFees", "accountancyFees"]) ?? 0,
    costOfServices: pick(expenses, ["costOfServices", "serviceCharges", "utilities", "cleaningAndGardening"]) ?? 0,
    travelCosts: pick(expenses, ["travelCosts", "travelForPropertyManagement"]) ?? 0,
    other: pick(expenses, ["other", "advertisingForTenants"]) ?? 0,
    residentialFinancialCost: pick(expenses, ["residentialFinancialCost", "loanInterestRestricted"]) ?? 0,
    residentialFinancialCostsCarriedForward: pick(expenses, ["residentialFinancialCostsCarriedForward"]) ?? 0,
    consolidatedExpenses: pick(expenses, ["consolidatedExpenses"]) ?? 0,
  };
}

export function mergeItsaObligations(responses: Array<{ obligations?: Array<Record<string, string>> }>) {
  const types = ["QUARTERLY_UPDATE", "EOPS", "FINAL_DECLARATION"] as const;
  return responses.flatMap((item, index) =>
    (item.obligations ?? []).map((row) => ({
      type: types[index] ?? "QUARTERLY_UPDATE",
      taxYear: row.taxYear ?? "",
      periodId: row.periodId,
      start: row.start ?? row.from ?? "",
      end: row.end ?? row.to ?? "",
      due: row.due ?? "",
      status: row.status === "F" || row.status === "Fulfilled" ? "Fulfilled" : "Open",
      businessId: row.businessId,
      received: row.received,
    })),
  );
}
