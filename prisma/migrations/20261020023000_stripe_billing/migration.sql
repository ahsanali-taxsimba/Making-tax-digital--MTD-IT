-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_PAYMENT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'BILLING_PAYMENT_SUCCEEDED';

-- CreateEnum
CREATE TYPE "BillingAudience" AS ENUM ('BUSINESS', 'PRACTICE');

-- CreateEnum
CREATE TYPE "BillingModel" AS ENUM ('FLAT', 'PER_UNIT');

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN "stripeCustomerId" TEXT;
ALTER TABLE "Firm" ADD COLUMN "billingVatNumber" TEXT;

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "audience" "BillingAudience" NOT NULL,
    "billingModel" "BillingModel" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "unitAmountPence" INTEGER NOT NULL,
    "interval" TEXT NOT NULL DEFAULT 'month',
    "vatPercent" INTEGER NOT NULL DEFAULT 20,
    "vatInclusive" BOOLEAN NOT NULL DEFAULT false,
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "maxQuantity" INTEGER,
    "features" JSONB NOT NULL,
    "highlight" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "stripeProductId" TEXT,
    "stripePriceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmSubscription" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'trialing',
    "stripeCustomerId" TEXT,
    "stripeSubscriptionId" TEXT,
    "stripePriceId" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "trialEndsAt" TIMESTAMP(3),
    "vatNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingInvoice" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "stripeInvoiceId" TEXT,
    "number" TEXT,
    "status" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "subtotalPence" INTEGER NOT NULL,
    "taxPence" INTEGER NOT NULL,
    "totalPence" INTEGER NOT NULL,
    "hostedInvoiceUrl" TEXT,
    "invoicePdfUrl" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingUsageSnapshot" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stripeUsageId" TEXT,

    CONSTRAINT "BillingUsageSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "payload" JSONB NOT NULL,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BillingPlan_slug_key" ON "BillingPlan"("slug");

-- CreateIndex
CREATE INDEX "BillingPlan_enabled_audience_sortOrder_idx" ON "BillingPlan"("enabled", "audience", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "FirmSubscription_firmId_key" ON "FirmSubscription"("firmId");

-- CreateIndex
CREATE INDEX "FirmSubscription_status_idx" ON "FirmSubscription"("status");

-- CreateIndex
CREATE INDEX "FirmSubscription_planId_idx" ON "FirmSubscription"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingInvoice_stripeInvoiceId_key" ON "BillingInvoice"("stripeInvoiceId");

-- CreateIndex
CREATE INDEX "BillingInvoice_firmId_createdAt_idx" ON "BillingInvoice"("firmId", "createdAt");

-- CreateIndex
CREATE INDEX "BillingUsageSnapshot_firmId_recordedAt_idx" ON "BillingUsageSnapshot"("firmId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_stripeEventId_key" ON "BillingEvent"("stripeEventId");

-- AddForeignKey
ALTER TABLE "FirmSubscription" ADD CONSTRAINT "FirmSubscription_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmSubscription" ADD CONSTRAINT "FirmSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingInvoice" ADD CONSTRAINT "BillingInvoice_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "FirmSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingUsageSnapshot" ADD CONSTRAINT "BillingUsageSnapshot_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "FirmSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
