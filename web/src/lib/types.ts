export type ApiSuccess<T> = { data: T; error: null };
export type ApiFailure = {
  data: null;
  error: { code?: string; errorCode?: string; message: string; details?: unknown };
};
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export type UserRole = "ADMIN" | "ACCOUNTANT" | "CLIENT";
export type HmrcEnvironment = "sandbox" | "live" | "SANDBOX" | "LIVE";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firmId: string;
  clientId: string | null;
  name: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  user: AuthUser;
}

export interface ClientRecord {
  id: string;
  name: string;
  type?: string;
  vatRegistrationNumber?: string | null;
  nino?: string | null;
}

export interface HmrcConnectionRow {
  id: string;
  environment: string;
  scopes: string[];
  tokenExpiresAt: string;
  disconnectedAt: string | null;
}

export interface HmrcStatus {
  connected: boolean;
  expiresAt: string | null;
  environment: string | null;
  connections: HmrcConnectionRow[];
}

export interface HmrcStartResult {
  authorizationUrl: string;
  redirectUrl: string;
  state: string;
  environment: string;
  redirectUri: string;
  mode?: "mock" | "live";
}

export interface HmrcCallbackResult {
  connected: boolean;
  clientId: string;
  environment: string;
  tokenExpiresAt: string;
}

export interface VatObligation {
  id: string;
  clientId: string;
  periodKey: string;
  start: string;
  end: string;
  due: string;
  status: "OPEN" | "FULFILLED" | "O" | "F";
  received?: string | null;
}

export interface VatValidation {
  vatReturn?: Record<string, number>;
  totals?: Record<string, number>;
  validation: { valid: boolean; errors: string[]; warnings: string[]; issues: string[] };
}

export interface ItsaBusiness {
  id: string;
  type: string;
  tradingName?: string | null;
  hmrcBusinessId?: string | null;
}

export interface ItsaObligation {
  id: string;
  clientId: string;
  businessId?: string | null;
  business?: ItsaBusiness | null;
  type: string;
  taxYear: string;
  periodId?: string | null;
  start: string;
  end: string;
  due: string;
  status: "OPEN" | "FULFILLED" | "Open" | "Fulfilled";
  received?: string | null;
}

export interface ItsaValidation {
  kind?: string;
  incomes?: Record<string, number>;
  expenses?: Record<string, number>;
  excluded?: Array<{ code?: number; category?: string; amount?: number; reason?: string }>;
  validation: { valid: boolean; errors: string[]; warnings: string[]; issues: string[] };
}

export interface VatReturnRecord {
  id?: string;
  clientId?: string;
  periodKey: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  status?: string;
  box1?: number;
  box2?: number;
  box3?: number;
  box4?: number;
  box5?: number;
  box6?: number;
  box7?: number;
  box8?: number;
  box9?: number;
  vatDueSales?: number;
  netVatDue?: number;
  processingDate?: string | null;
}

export interface ItsaUpdateRecord {
  id: string;
  clientId: string;
  businessId?: string | null;
  business?: ItsaBusiness | null;
  taxYear: string;
  periodId: string;
  periodStart: string;
  periodEnd: string;
  incomes: Record<string, number>;
  expenses: Record<string, number>;
  status: string;
}

export interface ItsaEopsRecord {
  id: string;
  businessId?: string | null;
  business?: ItsaBusiness | null;
  taxYear: string;
  typeOfBusiness: string;
  status: string;
  finalised: boolean;
}

export interface ItsaFinalRecord {
  id: string;
  taxYear: string;
  status: string;
  finalised: boolean;
}

export interface PortalDocument {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  category?: string | null;
  status: "PENDING" | "USED";
  createdAt: string;
}

export interface PortalMessage {
  id: string;
  clientId: string;
  authorId: string;
  authorRole: UserRole;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface PortalTask {
  id: string;
  type: string;
  status: string;
  title: string;
  dueDate?: string | null;
}

export interface BookkeepingItsaSummary {
  incomes?: Record<string, number>;
  expenses?: Record<string, number>;
  totals?: Record<string, number>;
}
