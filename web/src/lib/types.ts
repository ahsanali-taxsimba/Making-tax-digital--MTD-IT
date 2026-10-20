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
