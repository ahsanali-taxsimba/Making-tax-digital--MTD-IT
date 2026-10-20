import { Injectable } from "@nestjs/common";
import { HmrcEnvironment } from "@prisma/client";
import { HmrcHttpClient } from "./hmrc.http";
import { HmrcAppConfigService } from "./oauth/hmrc-app-config.service";
import { buildHmrcAuthorizeUrl } from "./oauth/hmrc-oauth.utils";
import {
  EopsPayload,
  FinalDeclarationPayload,
  HmrcCallContext,
  HmrcItsaGateway,
  HmrcOAuthGateway,
  HmrcVatGateway,
  QuarterlyUpdatePayload,
  VatObligationDto,
  VatPaymentDto,
  VatReturnBoxes,
  VatSubmitResult,
} from "./hmrc.types";
import { mapHmrcError } from "./hmrc.errors";

@Injectable()
export class LiveHmrcOAuthGateway implements HmrcOAuthGateway {
  constructor(
    private readonly apps: HmrcAppConfigService,
    private readonly http: HmrcHttpClient,
  ) {}

  buildAuthorizeUrl(params: { state: string; scopes: string[]; environment: HmrcEnvironment }): string {
    return buildHmrcAuthorizeUrl(this.apps.requireSettings(params.environment, true), params.state, params.scopes);
  }

  async exchangeCode(params: { code: string; environment: HmrcEnvironment }) {
    const app = this.apps.requireSettings(params.environment, true);
    return this.token(app.environment, {
      grant_type: "authorization_code",
      code: params.code,
      redirect_uri: app.redirectUri,
    });
  }

  async refresh(params: { refreshToken: string; environment: HmrcEnvironment }) {
    return this.token(params.environment, {
      grant_type: "refresh_token",
      refresh_token: params.refreshToken,
    });
  }

  async revoke(params: { token: string; environment: HmrcEnvironment }) {
    const app = this.apps.requireSettings(params.environment, true);
    const payload = new URLSearchParams({
      token: params.token,
      client_id: app.clientId,
      client_secret: app.clientSecret,
    });
    const response = await fetch(new URL("/oauth/revoke", app.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });
    if (!response.ok && response.status !== 404) {
      throw mapHmrcError(response.status, await response.json().catch(() => ({})));
    }
  }

  private async token(environment: HmrcEnvironment, body: Record<string, string>) {
    const app = this.apps.requireSettings(environment, true);
    const payload = new URLSearchParams({
      ...body,
      client_id: app.clientId,
      client_secret: app.clientSecret,
    });
    const response = await fetch(new URL("/oauth/token", app.baseUrl), {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload.toString(),
    });
    const json = (await response.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      scope?: string;
      error?: string;
      error_description?: string;
    };
    if (!response.ok || !json.access_token || !json.refresh_token) {
      throw mapHmrcError(response.status, json);
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresIn: json.expires_in ?? 14400,
      scope: json.scope ?? "",
    };
  }
}

@Injectable()
export class LiveHmrcVatGateway implements HmrcVatGateway {
  readonly name = "hmrc-vat";

  constructor(private readonly http: HmrcHttpClient) {}

  getObligations(ctx: HmrcCallContext, vrn: string, query?: { from?: string; to?: string; status?: string }) {
    return this.http.request<{ obligations: VatObligationDto[] }>(ctx, "GET", `/organisations/vat/${vrn}/obligations`, {
      query,
    });
  }

  getReturn(ctx: HmrcCallContext, vrn: string, periodKey: string) {
    return this.http.request<VatReturnBoxes>(ctx, "GET", `/organisations/vat/${vrn}/returns/${encodeURIComponent(periodKey)}`);
  }

  submitReturn(ctx: HmrcCallContext, vrn: string, body: VatReturnBoxes) {
    return this.http.request<VatSubmitResult>(ctx, "POST", `/organisations/vat/${vrn}/returns`, { body });
  }

  getPayments(ctx: HmrcCallContext, vrn: string, query?: { from?: string; to?: string }) {
    return this.http.request<{ payments: VatPaymentDto[] }>(ctx, "GET", `/organisations/vat/${vrn}/payments`, { query });
  }
}

@Injectable()
export class LiveHmrcItsaGateway implements HmrcItsaGateway {
  readonly name = "hmrc-itsa";

  constructor(private readonly http: HmrcHttpClient) {}

  async getObligations(ctx: HmrcCallContext, nino: string) {
    const [ie, eops, finalDecl] = await Promise.all([
      this.http.request<{ obligations: Array<Record<string, string>> }>(
        ctx,
        "GET",
        `/obligations/details/${nino}/income-and-expenditure`,
        { accept: "application/vnd.hmrc.2.0+json" },
      ),
      this.http.request<{ obligations: Array<Record<string, string>> }>(
        ctx,
        "GET",
        `/obligations/details/${nino}/eops`,
        { accept: "application/vnd.hmrc.2.0+json" },
      ),
      this.http.request<{ obligations: Array<Record<string, string>> }>(
        ctx,
        "GET",
        `/obligations/details/${nino}/crystallisation`,
        { accept: "application/vnd.hmrc.2.0+json" },
      ),
    ]);
    return {
      correlationId: ie.correlationId,
      status: ie.status,
      data: {
        obligations: [
          ...this.normalise(ie.data.obligations, "QUARTERLY_UPDATE"),
          ...this.normalise(eops.data.obligations, "EOPS"),
          ...this.normalise(finalDecl.data.obligations, "FINAL_DECLARATION"),
        ],
      },
    };
  }

  submitQuarterlyUpdate(ctx: HmrcCallContext, nino: string, payload: QuarterlyUpdatePayload) {
    const path = `/individuals/business/self-employment/${nino}/${payload.businessId}/period/${payload.taxYear}`;
    return this.http.request<{ periodId: string }>(ctx, "POST", path, {
      accept: "application/vnd.hmrc.5.0+json",
      body: {
        periodDates: { periodStartDate: payload.periodStart, periodEndDate: payload.periodEnd },
        periodIncome: payload.incomes,
        periodExpenses: payload.expenses,
      },
    });
  }

  submitEops(ctx: HmrcCallContext, nino: string, payload: EopsPayload) {
    const path = `/individuals/business/end-of-period-statement/nino/${nino}/${payload.businessId}/${payload.taxYear}`;
    return this.http.request<{ processingDate: string }>(ctx, "POST", path, {
      accept: "application/vnd.hmrc.3.0+json",
      body: {
        typeOfBusiness: payload.typeOfBusiness,
        accountingPeriod: { startDate: payload.accountingPeriodStart, endDate: payload.accountingPeriodEnd },
        finalised: payload.finalised,
      },
    });
  }

  submitFinalDeclaration(ctx: HmrcCallContext, nino: string, payload: FinalDeclarationPayload) {
    const path = `/individuals/calculations/${nino}/self-assessment/${payload.taxYear}/final-declaration`;
    return this.http.request<{ calculationId: string }>(ctx, "POST", path, {
      accept: "application/vnd.hmrc.5.0+json",
      body: { finalised: payload.finalised, calculationId: payload.calculationId },
    });
  }

  private normalise(
    items: Array<Record<string, string>> | undefined,
    type: "QUARTERLY_UPDATE" | "EOPS" | "FINAL_DECLARATION",
  ) {
    return (items ?? []).map((item) => ({
      type,
      taxYear: item.taxYear ?? "",
      periodId: item.periodId,
      start: item.start ?? item.from ?? "",
      end: item.end ?? item.to ?? "",
      due: item.due ?? "",
      status: (item.status === "F" || item.status === "Fulfilled" ? "Fulfilled" : "Open") as "Open" | "Fulfilled",
      businessId: item.businessId,
      received: item.received,
    }));
  }
}
