import { HmrcEnvironment } from "@prisma/client";

export interface FraudPreventionContext {
  publicIp?: string;
  timezone?: string;
  userIds?: string;
  deviceId?: string;
  vendorForwarded?: Record<string, string>;
}

export interface HmrcCallContext {
  environment: HmrcEnvironment;
  accessToken: string;
  fraud?: FraudPreventionContext;
  clientId?: string;
}

export interface VatObligationDto {
  periodKey: string;
  start: string;
  end: string;
  due: string;
  status: "O" | "F";
  received?: string;
}

export interface VatReturnBoxes {
  periodKey: string;
  vatDueSales: number;
  vatDueAcquisitions: number;
  totalVatDue: number;
  vatReclaimedCurrPeriod: number;
  netVatDue: number;
  totalValueSalesExVAT: number;
  totalValuePurchasesExVAT: number;
  totalValueGoodsSuppliedExVAT: number;
  totalAcquisitionsExVAT: number;
  finalised: boolean;
}

export interface VatSubmitResult {
  processingDate: string;
  formBundleNumber?: string;
  chargeRefNumber?: string;
  paymentIndicator?: string;
}

export interface VatPaymentDto {
  amount: number;
  received: string;
}

export interface ItsaObligationDto {
  type: "QUARTERLY_UPDATE" | "EOPS" | "FINAL_DECLARATION";
  taxYear: string;
  periodId?: string;
  start: string;
  end: string;
  due: string;
  status: "Open" | "Fulfilled";
  businessId?: string;
  received?: string;
}

export interface QuarterlyUpdatePayload {
  businessId: string;
  taxYear: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
  incomes: Record<string, number>;
  expenses: Record<string, number>;
}

export interface EopsPayload {
  businessId: string;
  taxYear: string;
  typeOfBusiness: string;
  accountingPeriodStart: string;
  accountingPeriodEnd: string;
  finalised: boolean;
}

export interface FinalDeclarationPayload {
  taxYear: string;
  calculationId?: string;
  finalised: boolean;
}

export interface HmrcHttpResult<T> {
  data: T;
  correlationId: string;
  status: number;
}

/**
 * Shared abstraction so a future Xero / QuickBooks connector can sit beside HMRC
 * without leaking vendor details into VAT/ITSA application services.
 */
export interface AccountingProvider {
  readonly name: string;
}

export interface HmrcVatGateway extends AccountingProvider {
  getObligations(ctx: HmrcCallContext, vrn: string, query?: { from?: string; to?: string; status?: string }): Promise<HmrcHttpResult<{ obligations: VatObligationDto[] }>>;
  getReturn(ctx: HmrcCallContext, vrn: string, periodKey: string): Promise<HmrcHttpResult<VatReturnBoxes>>;
  submitReturn(ctx: HmrcCallContext, vrn: string, body: VatReturnBoxes): Promise<HmrcHttpResult<VatSubmitResult>>;
  getPayments(ctx: HmrcCallContext, vrn: string, query?: { from?: string; to?: string }): Promise<HmrcHttpResult<{ payments: VatPaymentDto[] }>>;
}

export interface HmrcItsaGateway extends AccountingProvider {
  getObligations(ctx: HmrcCallContext, nino: string): Promise<HmrcHttpResult<{ obligations: ItsaObligationDto[] }>>;
  submitQuarterlyUpdate(ctx: HmrcCallContext, nino: string, payload: QuarterlyUpdatePayload): Promise<HmrcHttpResult<{ periodId: string }>>;
  submitEops(ctx: HmrcCallContext, nino: string, payload: EopsPayload): Promise<HmrcHttpResult<{ processingDate: string }>>;
  submitFinalDeclaration(ctx: HmrcCallContext, nino: string, payload: FinalDeclarationPayload): Promise<HmrcHttpResult<{ calculationId: string }>>;
}

export interface HmrcOAuthGateway {
  buildAuthorizeUrl(params: { state: string; scopes: string[]; environment: HmrcEnvironment }): string;
  exchangeCode(params: { code: string; environment: HmrcEnvironment }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope: string;
  }>;
  refresh(params: { refreshToken: string; environment: HmrcEnvironment }): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    scope?: string;
  }>;
  revoke?(params: { token: string; environment: HmrcEnvironment }): Promise<void>;
}
