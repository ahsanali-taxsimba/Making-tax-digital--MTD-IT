export type ApiSuccess<T> = { data: T; error: null };
export type ApiFailure = {
  data: null;
  error: { code?: string; errorCode?: string; message: string; details?: unknown };
};
export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export type UserRole = "ADMIN" | "ACCOUNTANT" | "ASSISTANT" | "CLIENT";
export type PlatformRole = "admin_super" | "admin_owner" | "admin_marketing" | "admin_developer" | "admin_support";
export type FirmRole = "firm_admin" | "firm_accountant" | "firm_staff" | "firm_client";
export type PrincipalKind = "platform" | "firm";
export type CanonicalRole = PlatformRole | FirmRole;
export type UserStatus = "ACTIVE" | "INVITED" | "SUSPENDED";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
export type ClientType = "INDIVIDUAL" | "COMPANY" | "LANDLORD" | "PARTNERSHIP";
export type PracticeTaskStatus = "OPEN" | "IN_PROGRESS" | "WAITING_ON_CLIENT" | "COMPLETED" | "CANCELLED";
export type PracticeTaskType =
  | "VAT_RETURN"
  | "ITSA_UPDATE"
  | "EOPS"
  | "FINAL_DECLARATION"
  | "BOOKKEEPING"
  | "RECONCILIATION"
  | "MTD_VAT_RETURN"
  | "MTD_ITSA_UPDATE"
  | "MTD_ITSA_EOPS"
  | "MTD_ITSA_FINAL_DECLARATION"
  | "MTD_TOKEN_EXPIRING"
  | "PROVIDE_RECORDS"
  | "APPROVE_RETURN";
export type HmrcEnvironment = "sandbox" | "live" | "SANDBOX" | "LIVE";
export type HmrcLinkStatus = "connected" | "disconnected" | "not_connected";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  firmId: string;
  clientId: string | null;
  name: string;
  principal?: PrincipalKind;
  platformRole?: PlatformRole;
  firmRole?: FirmRole;
  isActive?: boolean;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  tokenType: "Bearer";
  user: AuthUser;
}

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  clientId?: string | null;
  createdAt?: string;
}

export interface FirmRecord {
  id: string;
  name: string;
  address?: string | null;
  contactEmail: string;
  planType?: string;
  billingStatus?: string;
}

export interface TaskWorkloadRow {
  userId: string | null;
  name: string;
  role: UserRole | null;
  status: UserStatus | null;
  open: number;
  inProgress: number;
  waitingOnClient: number;
  completed: number;
}

export interface DashboardDueItem {
  due: string;
  label: string;
  clientName: string;
}

export interface FirmDashboard {
  firm: FirmRecord;
  staffCount: number;
  clientCount: number;
  openVatObligations: number;
  openItsaObligations: number;
  openObligations: number;
  unmatchedBank: number;
  overdueInvoices: number;
  openTasks: number;
  documents: number;
  receipts: number;
  unattachedReceipts: number;
  suggestedCategories: number;
  suggestedMatches: number;
  extractionReview: number;
  hmrcConnected: number;
  nextVatDue?: DashboardDueItem | null;
  nextItsaDue?: DashboardDueItem | null;
  taskWorkload: TaskWorkloadRow[];
}

export interface AssignedStaff {
  id: string;
  name: string;
  role: UserRole;
  status?: UserStatus;
}

export interface ClientRecord {
  id: string;
  name: string;
  type?: ClientType | string;
  vatRegistrationNumber?: string | null;
  nino?: string | null;
  utr?: string | null;
  riskLevel?: RiskLevel;
  assignedUserId?: string | null;
  assignedUser?: AssignedStaff | null;
  mtdConnections?: Array<{
    id: string;
    environment: string;
    scopes: string[];
    tokenExpiresAt: string;
    disconnectedAt?: string | null;
  }>;
}

export interface PracticeTask {
  id: string;
  firmId?: string;
  clientId: string;
  type: PracticeTaskType | string;
  status: PracticeTaskStatus | string;
  title: string;
  dueDate?: string | null;
  assigneeId?: string | null;
  completedAt?: string | null;
  client?: { id: string; name: string; type?: string } | null;
  assignee?: AssignedStaff | null;
}

export interface HmrcConnectionOverview {
  clientId: string;
  clientName: string;
  environment: string;
  vatStatus: HmrcLinkStatus;
  itsaStatus: HmrcLinkStatus;
  connected: boolean;
  tokenExpiresAt?: string | null;
  lastHmrcInteraction?: {
    at: string;
    actionType: string;
    method?: string | null;
    path?: string | null;
    statusCode?: number | null;
  } | null;
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
  proof?: { box4?: { items: number; withProof: number; proofAttached: boolean } };
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
