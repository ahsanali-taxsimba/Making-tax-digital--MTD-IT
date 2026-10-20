-- AlterTable
ALTER TABLE "BankAccount" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'GBP';
ALTER TABLE "BankAccount" ADD COLUMN "balance" DECIMAL(14,2) NOT NULL DEFAULT 0;
ALTER TABLE "BankAccount" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "BankTransaction" ADD COLUMN "merchantName" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "category" TEXT;
ALTER TABLE "BankTransaction" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateEnum
CREATE TYPE "YapilyConsentStatus" AS ENUM ('PENDING', 'AUTHORISED', 'EXPIRED', 'REVOKED');

-- CreateTable
CREATE TABLE "YapilyConnection" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "applicationUserId" TEXT,
    "consentId" TEXT,
    "consentTokenEnc" TEXT,
    "status" "YapilyConsentStatus" NOT NULL DEFAULT 'PENDING',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "YapilyConnection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BankAccount_clientId_provider_idx" ON "BankAccount"("clientId", "provider");
CREATE INDEX "BankTransaction_bankAccountId_externalRef_idx" ON "BankTransaction"("bankAccountId", "externalRef");
CREATE UNIQUE INDEX "YapilyConnection_clientId_institutionId_key" ON "YapilyConnection"("clientId", "institutionId");
CREATE INDEX "YapilyConnection_clientId_idx" ON "YapilyConnection"("clientId");

-- AddForeignKey
ALTER TABLE "YapilyConnection" ADD CONSTRAINT "YapilyConnection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
