-- CreateEnum
CREATE TYPE "MatchingStatus" AS ENUM ('SUGGESTED', 'APPLIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MatchingDocumentKind" AS ENUM ('invoice', 'bill');

-- CreateTable
CREATE TABLE "MatchingSuggestion" (
    "id" TEXT NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "documentKind" "MatchingDocumentKind" NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentReference" TEXT,
    "partyName" TEXT,
    "amountGap" DECIMAL(14,2) NOT NULL,
    "dateGapDays" INTEGER NOT NULL,
    "confidence" DECIMAL(4,3) NOT NULL,
    "reasons" JSONB NOT NULL,
    "signals" JSONB NOT NULL,
    "status" "MatchingStatus" NOT NULL DEFAULT 'SUGGESTED',
    "journalEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MatchingSuggestion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MatchingSuggestion_bankTransactionId_key" ON "MatchingSuggestion"("bankTransactionId");
CREATE INDEX "MatchingSuggestion_clientId_status_idx" ON "MatchingSuggestion"("clientId", "status");
CREATE INDEX "MatchingSuggestion_documentKind_documentId_idx" ON "MatchingSuggestion"("documentKind", "documentId");

-- AddForeignKey
ALTER TABLE "MatchingSuggestion" ADD CONSTRAINT "MatchingSuggestion_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchingSuggestion" ADD CONSTRAINT "MatchingSuggestion_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MatchingSuggestion" ADD CONSTRAINT "MatchingSuggestion_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON UPDATE CASCADE;
