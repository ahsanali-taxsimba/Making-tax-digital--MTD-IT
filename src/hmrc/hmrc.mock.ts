import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  EopsPayload,
  FinalDeclarationPayload,
  HmrcCallContext,
  HmrcHttpResult,
  HmrcItsaGateway,
  HmrcOAuthGateway,
  HmrcVatGateway,
  QuarterlyUpdatePayload,
  VatReturnBoxes,
} from "./hmrc.types";
import { HmrcEnvironment } from "@prisma/client";

const result = <T>(data: T): HmrcHttpResult<T> => ({
  data,
  correlationId: randomUUID(),
  status: 200,
});

@Injectable()
export class MockHmrcVatGateway implements HmrcVatGateway {
  readonly name = "hmrc-vat-mock";

  async getObligations() {
    return result({
      obligations: [
        {
          periodKey: "26A1",
          start: "2026-01-01",
          end: "2026-03-31",
          due: "2026-05-07",
          status: "O" as const,
        },
        {
          periodKey: "25A4",
          start: "2025-10-01",
          end: "2025-12-31",
          due: "2026-02-07",
          status: "F" as const,
          received: "2026-02-01",
        },
      ],
    });
  }

  async getReturn(_ctx: HmrcCallContext, _vrn: string, periodKey: string) {
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

  async submitReturn(_ctx: HmrcCallContext, _vrn: string, _body: VatReturnBoxes) {
    return result({
      processingDate: new Date().toISOString(),
      formBundleNumber: "123456789012",
      paymentIndicator: "DD",
    });
  }

  async getPayments() {
    return result({
      payments: [{ amount: 1000, received: "2026-02-10" }],
    });
  }
}

@Injectable()
export class MockHmrcItsaGateway implements HmrcItsaGateway {
  readonly name = "hmrc-itsa-mock";

  async getObligations() {
    return result({
      obligations: [
        {
          type: "QUARTERLY_UPDATE" as const,
          taxYear: "2025-26",
          periodId: "2026-04-06_2026-07-05",
          start: "2026-04-06",
          end: "2026-07-05",
          due: "2026-08-07",
          status: "Open" as const,
          businessId: "XAIS12345678901",
        },
        {
          type: "EOPS" as const,
          taxYear: "2025-26",
          start: "2026-04-06",
          end: "2027-04-05",
          due: "2027-01-31",
          status: "Open" as const,
          businessId: "XAIS12345678901",
        },
        {
          type: "FINAL_DECLARATION" as const,
          taxYear: "2025-26",
          start: "2026-04-06",
          end: "2027-04-05",
          due: "2027-01-31",
          status: "Open" as const,
        },
      ],
    });
  }

  async submitQuarterlyUpdate(_ctx: HmrcCallContext, _nino: string, payload: QuarterlyUpdatePayload) {
    return result({ periodId: payload.periodId });
  }

  async submitEops() {
    return result({ processingDate: new Date().toISOString() });
  }

  async submitFinalDeclaration(_ctx: HmrcCallContext, _nino: string, payload: FinalDeclarationPayload) {
    return result({ calculationId: payload.calculationId ?? randomUUID() });
  }
}

@Injectable()
export class MockHmrcOAuthGateway implements HmrcOAuthGateway {
  buildAuthorizeUrl(params: { state: string; scopes: string[]; environment: HmrcEnvironment }): string {
    return `https://mock-hmrc.local/oauth/authorize?state=${params.state}&env=${params.environment}&scope=${encodeURIComponent(params.scopes.join(" "))}`;
  }

  async exchangeCode() {
    return {
      accessToken: `mock-access-${randomUUID()}`,
      refreshToken: `mock-refresh-${randomUUID()}`,
      expiresIn: 14400,
      scope: "read:vat write:vat read:self-assessment write:self-assessment",
    };
  }

  async refresh() {
    return {
      accessToken: `mock-access-${randomUUID()}`,
      refreshToken: `mock-refresh-${randomUUID()}`,
      expiresIn: 14400,
    };
  }
}
