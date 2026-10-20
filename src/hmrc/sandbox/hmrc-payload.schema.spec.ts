import { HMRC_ERR } from "../client/hmrc-client.errors";
import {
  validateEopsPayload,
  validateFinalDeclarationPayload,
  validateHmrcBody,
  validateQuarterlyUpdatePayload,
  validateVatReturnPayload,
} from "./hmrc-payload.schema";

const vatReturn = {
  periodKey: "26A1",
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
};

describe("HMRC payload schemas", () => {
  it("accepts a VAT (MTD) 1.0 return body", () => {
    expect(validateVatReturnPayload(vatReturn).periodKey).toBe("26A1");
  });

  it("rejects a VAT return that is not finalised or has broken box 3 arithmetic", () => {
    expect(() => validateVatReturnPayload({ ...vatReturn, finalised: false })).toThrow(
      expect.objectContaining({ errorCode: HMRC_ERR.BAD_REQUEST }),
    );
    expect(() => validateVatReturnPayload({ ...vatReturn, totalVatDue: 1 })).toThrow(
      expect.objectContaining({ errorCode: HMRC_ERR.BAD_REQUEST }),
    );
  });

  it("accepts a quarterly / UK property periodic update", () => {
    const payload = validateQuarterlyUpdatePayload({
      businessId: "XAIS1",
      taxYear: "2025-26",
      periodId: "q1",
      periodStart: "2026-04-06",
      periodEnd: "2026-07-05",
      incomes: { turnover: 100.5 },
      expenses: { officeCosts: 10 },
    });
    expect(payload.incomes.turnover).toBe(100.5);
  });

  it("requires finalised EOPS and Final Declaration bodies", () => {
    expect(
      validateEopsPayload({
        businessId: "XAIS1",
        taxYear: "2025-26",
        typeOfBusiness: "uk-property",
        accountingPeriodStart: "2026-04-06",
        accountingPeriodEnd: "2027-04-05",
        finalised: true,
      }).typeOfBusiness,
    ).toBe("uk-property");
    expect(validateFinalDeclarationPayload({ taxYear: "2025-26", finalised: true }).finalised).toBe(true);
    expect(() => validateFinalDeclarationPayload({ taxYear: "2025-26", finalised: false })).toThrow(
      expect.objectContaining({ errorCode: HMRC_ERR.BAD_REQUEST }),
    );
  });

  it("validates by path for sandbox VAT and ITSA URLs", () => {
    expect(validateHmrcBody("POST", "/organisations/vat/888888888/returns", vatReturn)).toEqual(vatReturn);
    expect(
      validateHmrcBody("PUT", "/income-tax/AA123456A/uk-property/periodic", {
        businessId: "XAIS1",
        taxYear: "2025-26",
        periodStart: "2026-04-06",
        periodEnd: "2026-07-05",
        incomes: { periodAmount: 1 },
        expenses: {},
      }),
    ).toEqual(expect.objectContaining({ businessId: "XAIS1" }));
  });
});
