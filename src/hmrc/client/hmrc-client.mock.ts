import { randomUUID } from "crypto";
import { HmrcHttpResult } from "../hmrc.types";

const result = <T>(data: T): HmrcHttpResult<T> => ({
  data,
  correlationId: randomUUID(),
  status: 200,
});

export function mockHmrcResponse(method: string, url: string, body?: unknown): HmrcHttpResult<unknown> | null {
  const path = url.split("?")[0];
  if (method === "GET" && /\/organisations\/vat\/[^/]+\/obligations$/.test(path)) {
    return result({
      obligations: [
        { periodKey: "26A1", start: "2026-01-01", end: "2026-03-31", due: "2026-05-07", status: "O" },
        { periodKey: "25A4", start: "2025-10-01", end: "2025-12-31", due: "2026-02-07", status: "F", received: "2026-02-01" },
      ],
    });
  }
  if (method === "GET" && /\/organisations\/vat\/[^/]+\/returns\/.+/.test(path)) {
    const periodKey = decodeURIComponent(path.split("/").pop() ?? "");
    return result({
      periodKey,
      vatDueSales: 1200,
      vatDueAcquisitions: 0,
      totalVatDue: 1200,
      vatReclaimedCurrPeriod: 200,
      netVatDue: 1000,
      totalValueSalesExVAT: 6000,
      totalValuePurchasesExVAT: 1000,
      totalValueGoodsSuppliedExVAT: 0,
      totalAcquisitionsExVAT: 0,
      finalised: true,
    });
  }
  if ((method === "POST" || method === "PUT") && /\/organisations\/vat\/[^/]+\/returns$/.test(path)) {
    return result({
      processingDate: new Date().toISOString(),
      formBundleNumber: "123456789012",
      paymentIndicator: "DD",
    });
  }
  if (method === "GET" && /\/organisations\/vat\/[^/]+\/payments$/.test(path)) {
    return result({ payments: [{ amount: 1000, received: "2026-02-10" }] });
  }
  if (method === "GET" && /\/income-tax\/[^/]+\/obligations$/.test(path)) {
    return result({
      obligations: [
        {
          type: "QUARTERLY_UPDATE",
          taxYear: "2025-26",
          periodId: "2026-04-06_2026-07-05",
          start: "2026-04-06",
          end: "2026-07-05",
          due: "2026-08-07",
          status: "Open",
          businessId: "XAIS12345678901",
        },
        {
          type: "EOPS",
          taxYear: "2025-26",
          start: "2026-04-06",
          end: "2027-04-05",
          due: "2027-01-31",
          status: "Open",
          businessId: "XAIS12345678901",
        },
        {
          type: "FINAL_DECLARATION",
          taxYear: "2025-26",
          start: "2026-04-06",
          end: "2027-04-05",
          due: "2027-01-31",
          status: "Open",
        },
      ],
    });
  }
  if ((method === "POST" || method === "PUT") && /\/income-tax\/[^/]+\/(updates|uk-property\/periodic)$/.test(path)) {
    const payload = (body ?? {}) as { periodId?: string };
    return result({ periodId: payload.periodId ?? "p1" });
  }
  if ((method === "POST" || method === "PUT") && /\/income-tax\/[^/]+\/(eops|uk-property\/eops)$/.test(path)) {
    return result({ processingDate: new Date().toISOString() });
  }
  if ((method === "POST" || method === "PUT") && /\/income-tax\/[^/]+\/(final-declaration|calculations\/final-declaration)$/.test(path)) {
    const payload = (body ?? {}) as { calculationId?: string };
    return result({ calculationId: payload.calculationId ?? randomUUID() });
  }
  if (method === "GET" && /\/income-tax\/[^/]+\/income-expenses$/.test(path)) {
    return result({
      incomes: { turnover: 5000, otherIncome: 0 },
      expenses: { officeCosts: 250 },
      obligations: [
        {
          type: "QUARTERLY_UPDATE",
          taxYear: "2025-26",
          periodId: "2026-04-06_2026-07-05",
          start: "2026-04-06",
          end: "2026-07-05",
          due: "2026-08-07",
          status: "Open",
        },
      ],
    });
  }
  return null;
}
