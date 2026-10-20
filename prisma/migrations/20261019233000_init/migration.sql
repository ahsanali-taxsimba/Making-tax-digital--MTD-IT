-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'ACCOUNTANT', 'CLIENT');
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
CREATE TYPE "PlanType" AS ENUM ('STARTER', 'PRACTICE', 'ENTERPRISE');
CREATE TYPE "BillingStatus" AS ENUM ('TRIAL', 'ACTIVE', 'PAST_DUE', 'CANCELLED');
CREATE TYPE "ClientType" AS ENUM ('INDIVIDUAL', 'COMPANY', 'LANDLORD', 'PARTNERSHIP');
CREATE TYPE "HmrcEnvironment" AS ENUM ('SANDBOX', 'LIVE');
CREATE TYPE "ObligationStatus" AS ENUM ('OPEN', 'FULFILLED');
CREATE TYPE "SubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED');
CREATE TYPE "TaskType" AS ENUM ('MTD_VAT_RETURN', 'MTD_ITSA_UPDATE', 'MTD_ITSA_EOPS', 'MTD_ITSA_FINAL_DECLARATION', 'MTD_TOKEN_EXPIRING');
CREATE TYPE "TaskStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
CREATE TYPE "NotificationType" AS ENUM ('OBLIGATION_FETCHED', 'TOKEN_EXPIRING', 'SUBMISSION_FAILED', 'SUBMISSION_SUCCEEDED');
CREATE TYPE "WebhookEventType" AS ENUM ('CLIENT_CREATED', 'MTD_CONNECTION_CREATED', 'VAT_RETURN_SUBMITTED', 'ITSA_UPDATE_SUBMITTED');
CREATE TYPE "LedgerAccountType" AS ENUM ('INCOME', 'EXPENSE', 'ASSET', 'LIABILITY', 'EQUITY');

-- CreateTable
CREATE TABLE "Firm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "contactEmail" TEXT NOT NULL,
    "planType" "PlanType" NOT NULL DEFAULT 'STARTER',
    "billingStatus" "BillingStatus" NOT NULL DEFAULT 'TRIAL',
    "webhookSecret" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Firm_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
    "passwordHash" TEXT,
    "externalAuthId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "type" "ClientType" NOT NULL,
    "name" TEXT NOT NULL,
    "utr" TEXT,
    "vatRegistrationNumber" TEXT,
    "niNumber" TEXT,
    "nino" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "hmrcBusinessId" TEXT,
    "type" TEXT NOT NULL,
    "tradingName" TEXT NOT NULL,
    "accountingType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MtdConnection" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "hmrcClientId" TEXT NOT NULL,
    "scopes" TEXT[],
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "tokenExpiresAt" TIMESTAMP(3) NOT NULL,
    "environment" "HmrcEnvironment" NOT NULL DEFAULT 'SANDBOX',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MtdConnection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OauthState" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "environment" "HmrcEnvironment" NOT NULL,
    "scopes" TEXT[],
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OauthState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VatObligation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodKey" TEXT NOT NULL,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "status" "ObligationStatus" NOT NULL,
    "received" TIMESTAMP(3),
    "correlationId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VatObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VatReturn" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "obligationId" TEXT,
    "periodKey" TEXT NOT NULL,
    "vatDueSales" DECIMAL(14,2) NOT NULL,
    "vatDueAcquisitions" DECIMAL(14,2) NOT NULL,
    "totalVatDue" DECIMAL(14,2) NOT NULL,
    "vatReclaimedCurrPeriod" DECIMAL(14,2) NOT NULL,
    "netVatDue" DECIMAL(14,2) NOT NULL,
    "totalValueSalesExVAT" DECIMAL(14,2) NOT NULL,
    "totalValuePurchasesExVAT" DECIMAL(14,2) NOT NULL,
    "totalValueGoodsSuppliedExVAT" DECIMAL(14,2) NOT NULL,
    "totalAcquisitionsExVAT" DECIMAL(14,2) NOT NULL,
    "finalised" BOOLEAN NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "formBundleNumber" TEXT,
    "chargeRefNumber" TEXT,
    "processingDate" TIMESTAMP(3),
    "correlationId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "VatReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VatPayment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "received" TIMESTAMP(3) NOT NULL,
    "correlationId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "VatPayment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItsaObligation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "businessId" TEXT,
    "type" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "periodId" TEXT,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "due" TIMESTAMP(3) NOT NULL,
    "status" "ObligationStatus" NOT NULL,
    "received" TIMESTAMP(3),
    "correlationId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ItsaObligation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItsaUpdate" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "businessId" TEXT,
    "taxYear" TEXT NOT NULL,
    "periodId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "incomes" JSONB NOT NULL,
    "expenses" JSONB NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "hmrcPeriodId" TEXT,
    "correlationId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ItsaUpdate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItsaEndOfPeriodStatement" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "businessId" TEXT,
    "taxYear" TEXT NOT NULL,
    "typeOfBusiness" TEXT NOT NULL,
    "accountingPeriodStart" TIMESTAMP(3) NOT NULL,
    "accountingPeriodEnd" TIMESTAMP(3) NOT NULL,
    "finalised" BOOLEAN NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "correlationId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ItsaEndOfPeriodStatement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItsaFinalDeclaration" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "calculationId" TEXT,
    "finalised" BOOLEAN NOT NULL,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "correlationId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ItsaFinalDeclaration_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Ledger" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Ledger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "ledgerId" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorUserId" TEXT,
    "firmId" TEXT,
    "clientId" TEXT,
    "actionType" TEXT NOT NULL,
    "metadata" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "userId" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEndpoint" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "events" "WebhookEventType"[],
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebhookEndpoint_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "eventType" "WebhookEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "deliveredAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SupportingDocument" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SupportingDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HmrcInteraction" (
    "id" TEXT NOT NULL,
    "clientId" TEXT,
    "correlationId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER,
    "requestBody" JSONB,
    "responseBody" JSONB,
    "errorCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HmrcInteraction_pkey" PRIMARY KEY ("id")
);

-- Indexes and constraints
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");
CREATE INDEX "Client_firmId_idx" ON "Client"("firmId");
CREATE UNIQUE INDEX "MtdConnection_clientId_environment_key" ON "MtdConnection"("clientId", "environment");
CREATE UNIQUE INDEX "OauthState_state_key" ON "OauthState"("state");
CREATE UNIQUE INDEX "VatObligation_clientId_periodKey_key" ON "VatObligation"("clientId", "periodKey");
CREATE UNIQUE INDEX "VatReturn_obligationId_key" ON "VatReturn"("obligationId");
CREATE UNIQUE INDEX "HmrcInteraction_correlationId_key" ON "HmrcInteraction"("correlationId");
CREATE INDEX "AuditLog_firmId_createdAt_idx" ON "AuditLog"("firmId", "createdAt");
CREATE INDEX "AuditLog_clientId_createdAt_idx" ON "AuditLog"("clientId", "createdAt");
CREATE INDEX "AuditLog_actorUserId_createdAt_idx" ON "AuditLog"("actorUserId", "createdAt");

ALTER TABLE "User" ADD CONSTRAINT "User_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "User" ADD CONSTRAINT "User_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Client" ADD CONSTRAINT "Client_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Business" ADD CONSTRAINT "Business_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MtdConnection" ADD CONSTRAINT "MtdConnection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VatObligation" ADD CONSTRAINT "VatObligation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VatReturn" ADD CONSTRAINT "VatReturn_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VatReturn" ADD CONSTRAINT "VatReturn_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "VatObligation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "VatPayment" ADD CONSTRAINT "VatPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItsaObligation" ADD CONSTRAINT "ItsaObligation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItsaObligation" ADD CONSTRAINT "ItsaObligation_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItsaUpdate" ADD CONSTRAINT "ItsaUpdate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItsaUpdate" ADD CONSTRAINT "ItsaUpdate_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItsaEndOfPeriodStatement" ADD CONSTRAINT "ItsaEndOfPeriodStatement_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItsaEndOfPeriodStatement" ADD CONSTRAINT "ItsaEndOfPeriodStatement_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ItsaFinalDeclaration" ADD CONSTRAINT "ItsaFinalDeclaration_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_ledgerId_fkey" FOREIGN KEY ("ledgerId") REFERENCES "Ledger"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "WebhookEndpoint" ADD CONSTRAINT "WebhookEndpoint_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupportingDocument" ADD CONSTRAINT "SupportingDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
