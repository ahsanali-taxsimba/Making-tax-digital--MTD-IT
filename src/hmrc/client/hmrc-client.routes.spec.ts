import { expandLiveCalls, mergeItsaObligations } from "./hmrc-client.routes";

describe("expandLiveCalls", () => {
  it("leaves VAT paths unchanged so the client can call them as-is", () => {
    expect(expandLiveCalls("GET", "/organisations/vat/888888888/obligations")).toBeNull();
    expect(expandLiveCalls("POST", "/organisations/vat/888888888/returns", { periodKey: "26A1" })).toBeNull();
  });

  it("expands ITSA obligations onto the official HMRC obligation APIs", () => {
    const calls = expandLiveCalls("GET", "/income-tax/AA123456A/obligations");
    expect(calls).toEqual([
      { path: "/obligations/details/AA123456A/income-and-expenditure", accept: "application/vnd.hmrc.2.0+json" },
      { path: "/obligations/details/AA123456A/eops", accept: "application/vnd.hmrc.2.0+json" },
      { path: "/obligations/details/AA123456A/crystallisation", accept: "application/vnd.hmrc.2.0+json" },
    ]);
  });

  it("maps a UK property periodic update onto the official PUT path", () => {
    const calls = expandLiveCalls("PUT", "/income-tax/AA123456A/uk-property/periodic", {
      businessId: "XAIS1",
      taxYear: "2025-26",
      periodId: "q1",
      periodStart: "2026-04-06",
      periodEnd: "2026-07-05",
      incomes: { periodAmount: 100 },
      expenses: { repairsAndMaintenance: 10 },
    });
    expect(calls?.[0].method).toBe("PUT");
    expect(calls?.[0].path).toBe("/individuals/business/property/uk/AA123456A/XAIS1/2025-26/q1");
    expect(calls?.[0].body).toEqual(
      expect.objectContaining({
        ukProperty: expect.objectContaining({
          income: expect.objectContaining({ periodAmount: 100 }),
        }),
      }),
    );
  });

  it("maps income-expenses onto the HMRC income-and-expenditure obligations feed", () => {
    expect(expandLiveCalls("GET", "/income-tax/AA123456A/income-expenses")?.[0].path).toBe(
      "/obligations/details/AA123456A/income-and-expenditure",
    );
  });

  it("maps a quarterly update onto the self-employment period API", () => {
    const calls = expandLiveCalls("POST", "/income-tax/AA123456A/updates", {
      businessId: "XAIS1",
      taxYear: "2025-26",
      periodId: "p1",
      periodStart: "2026-04-06",
      periodEnd: "2026-07-05",
      incomes: { turnover: 100 },
      expenses: { officeCosts: 10 },
    });
    expect(calls?.[0].path).toBe("/individuals/business/self-employment/AA123456A/XAIS1/period/2025-26");
    expect(calls?.[0].body).toEqual({
      periodDates: { periodStartDate: "2026-04-06", periodEndDate: "2026-07-05" },
      periodIncome: { turnover: 100 },
      periodExpenses: { officeCosts: 10 },
    });
  });

  it("maps EOPS and final declaration onto their live HMRC paths", () => {
    const eops = expandLiveCalls("POST", "/income-tax/AA123456A/eops", {
      businessId: "XAIS1",
      taxYear: "2025-26",
      typeOfBusiness: "self-employment",
      accountingPeriodStart: "2026-04-06",
      accountingPeriodEnd: "2027-04-05",
      finalised: true,
    });
    expect(eops?.[0].path).toBe("/individuals/business/end-of-period-statement/nino/AA123456A/XAIS1/2025-26");

    const final = expandLiveCalls("POST", "/income-tax/AA123456A/final-declaration", {
      taxYear: "2025-26",
      calculationId: "calc-1",
      finalised: true,
    });
    expect(final?.[0].path).toBe("/individuals/calculations/AA123456A/self-assessment/2025-26/final-declaration");
  });
});

describe("mergeItsaObligations", () => {
  it("tags each HMRC obligation feed with the matching ITSA type", () => {
    const merged = mergeItsaObligations([
      { obligations: [{ taxYear: "2025-26", start: "2026-04-06", end: "2026-07-05", due: "2026-08-07", status: "O", periodId: "q1" }] },
      { obligations: [{ taxYear: "2025-26", from: "2026-04-06", to: "2027-04-05", due: "2027-01-31", status: "F" }] },
      { obligations: [{ taxYear: "2025-26", start: "2026-04-06", end: "2027-04-05", due: "2027-01-31", status: "Open" }] },
    ]);
    expect(merged.map((row) => row.type)).toEqual(["QUARTERLY_UPDATE", "EOPS", "FINAL_DECLARATION"]);
    expect(merged[1].status).toBe("Fulfilled");
    expect(merged[1].start).toBe("2026-04-06");
  });
});
