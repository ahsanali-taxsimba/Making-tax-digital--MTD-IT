-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN "merchantCategoryCode" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "transactionCategory" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "location" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "labels" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "BankTransaction" ADD COLUMN "enrichment" JSONB;

-- CreateEnum
CREATE TYPE "CategorisationStatus" AS ENUM ('SUGGESTED', 'APPLIED', 'REJECTED');

-- CreateTable
CREATE TABLE "CategorisationMerchantRule" (
    "id" TEXT NOT NULL,
    "merchantKey" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "aliases" TEXT[],
    "categoryKey" TEXT NOT NULL,
    "ledgerCode" INTEGER NOT NULL,
    "taxCodeKind" "TaxCodeKind" NOT NULL,
    "itsaCategory" TEXT,
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.95,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorisationMerchantRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorisationMccRule" (
    "id" TEXT NOT NULL,
    "mcc" TEXT NOT NULL,
    "industry" TEXT NOT NULL,
    "categoryKey" TEXT NOT NULL,
    "ledgerCode" INTEGER NOT NULL,
    "taxCodeKind" "TaxCodeKind" NOT NULL,
    "vatable" BOOLEAN NOT NULL,
    "itsaCategory" TEXT,
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.85,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorisationMccRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CategorisationSuggestion" (
    "id" TEXT NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "ledgerAccountId" TEXT,
    "ledgerCode" INTEGER NOT NULL,
    "taxCodeId" TEXT,
    "taxCodeKind" "TaxCodeKind" NOT NULL,
    "itsaCategory" TEXT,
    "itsaBucket" TEXT,
    "vatBoxes" JSONB NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "reasons" JSONB NOT NULL,
    "draftJournal" JSONB NOT NULL,
    "status" "CategorisationStatus" NOT NULL DEFAULT 'SUGGESTED',
    "appliedJournalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CategorisationSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CategorisationMerchantRule_merchantKey_key" ON "CategorisationMerchantRule"("merchantKey");
CREATE UNIQUE INDEX "CategorisationMccRule_mcc_key" ON "CategorisationMccRule"("mcc");
CREATE UNIQUE INDEX "CategorisationSuggestion_bankTransactionId_key" ON "CategorisationSuggestion"("bankTransactionId");
CREATE INDEX "CategorisationSuggestion_clientId_status_idx" ON "CategorisationSuggestion"("clientId", "status");

-- AddForeignKey
ALTER TABLE "CategorisationSuggestion" ADD CONSTRAINT "CategorisationSuggestion_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategorisationSuggestion" ADD CONSTRAINT "CategorisationSuggestion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CategorisationSuggestion" ADD CONSTRAINT "CategorisationSuggestion_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON UPDATE CASCADE;
