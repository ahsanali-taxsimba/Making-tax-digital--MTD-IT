import { EopsPayload, FinalDeclarationPayload, QuarterlyUpdatePayload } from "../hmrc.types";

export interface LiveCall {
  path: string;
  accept?: string;
  body?: unknown;
}

const INCOME_TAX = /^\/income-tax\/([^/]+)\/(obligations|updates|eops|final-declaration|calculations)(?:\/([^/]+))?$/;

export function propertyApiKind(typeOfBusiness?: string): "self-employment" | "uk-property" | "foreign-property" {
  const value = (typeOfBusiness ?? "").toLowerCase();
  if (value.includes("foreign")) {
    return "foreign-property";
  }
  if (value.includes("property") || value.includes("landlord")) {
    return "uk-property";
  }
  return "self-employment";
}

export function expandLiveCalls(method: string, url: string, body?: unknown): LiveCall[] | null {
  const [pathPart, queryPart] = url.split("?");
  const match = INCOME_TAX.exec(pathPart);
  if (!match) {
    return null;
  }
  const nino = match[1];
  const action = match[2];
  const extra = match[3];
  const query = new URLSearchParams(queryPart ?? "");
  if (method === "GET" && action === "obligations") {
    return [
      { path: `/obligations/details/${nino}/income-and-expenditure`, accept: "application/vnd.hmrc.2.0+json" },
      { path: `/obligations/details/${nino}/eops`, accept: "application/vnd.hmrc.2.0+json" },
      { path: `/obligations/details/${nino}/crystallisation`, accept: "application/vnd.hmrc.2.0+json" },
    ];
  }
  if (method === "POST" && action === "updates") {
    const payload = body as QuarterlyUpdatePayload;
    const kind = propertyApiKind(payload.typeOfBusiness);
    return [
      {
        path: `/individuals/business/${kind}/${nino}/${payload.businessId}/period/${payload.taxYear}`,
        accept: "application/vnd.hmrc.5.0+json",
        body: {
          periodDates: { periodStartDate: payload.periodStart, periodEndDate: payload.periodEnd },
          periodIncome: payload.incomes,
          periodExpenses: payload.expenses,
        },
      },
    ];
  }
  if (method === "POST" && action === "eops") {
    const payload = body as EopsPayload;
    return [
      {
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
  if (method === "POST" && action === "final-declaration") {
    const payload = body as FinalDeclarationPayload;
    return [
      {
        path: `/individuals/calculations/${nino}/self-assessment/${payload.taxYear}/final-declaration`,
        accept: "application/vnd.hmrc.5.0+json",
        body: { finalised: payload.finalised, calculationId: payload.calculationId },
      },
    ];
  }
  if (action === "calculations") {
    const payload = (body ?? {}) as { taxYear?: string; calculationType?: string };
    const taxYear = payload.taxYear || query.get("taxYear") || "";
    if (method === "POST") {
      const calculationType = payload.calculationType || "intent-to-finalise";
      return [
        {
          path: `/individuals/calculations/${nino}/self-assessment/${taxYear}/trigger/${calculationType}`,
          accept: "application/vnd.hmrc.7.0+json",
          body: {},
        },
      ];
    }
    if (method === "GET" && extra) {
      return [
        {
          path: `/individuals/calculations/${nino}/self-assessment/${taxYear}/${extra}`,
          accept: "application/vnd.hmrc.7.0+json",
        },
      ];
    }
    if (method === "GET") {
      return [
        {
          path: `/individuals/calculations/${nino}/self-assessment/${taxYear}`,
          accept: "application/vnd.hmrc.7.0+json",
        },
      ];
    }
  }
  return null;
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
