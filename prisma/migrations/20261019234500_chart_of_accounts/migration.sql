-- AlterEnum
ALTER TYPE "LedgerAccountType" ADD VALUE 'CAPITAL';
ALTER TYPE "LedgerAccountType" ADD VALUE 'BALANCE_SHEET';

-- CreateEnum
CREATE TYPE "ChartProfile" AS ENUM ('LANDLORD', 'SOLE_TRADER', 'COMPANY');

-- Replace the generic seed ledgers before adding required columns
DELETE FROM "Transaction";
DELETE FROM "Ledger";

-- AlterTable
ALTER TABLE "Ledger" ADD COLUMN "profile" "ChartProfile" NOT NULL DEFAULT 'SOLE_TRADER';
ALTER TABLE "Ledger" ADD COLUMN "code" INTEGER NOT NULL;
ALTER TABLE "Ledger" ADD COLUMN "category" TEXT NOT NULL;

CREATE UNIQUE INDEX "Ledger_clientId_profile_code_key" ON "Ledger"("clientId", "profile", "code");
CREATE INDEX "Ledger_clientId_profile_idx" ON "Ledger"("clientId", "profile");
