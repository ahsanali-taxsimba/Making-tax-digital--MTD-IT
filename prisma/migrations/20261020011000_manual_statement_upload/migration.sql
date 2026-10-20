-- CreateEnum
CREATE TYPE "ManualStatementStatus" AS ENUM ('UPLOADED', 'PARSED', 'FAILED');

-- CreateTable
CREATE TABLE "ManualStatementUpload" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bankAccountId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL DEFAULT 'csv',
    "content" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "parsedAt" TIMESTAMP(3),
    "status" "ManualStatementStatus" NOT NULL DEFAULT 'UPLOADED',
    "profile" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "health" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualStatementUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualStatementUpload_clientId_uploadedAt_idx" ON "ManualStatementUpload"("clientId", "uploadedAt");

-- CreateIndex
CREATE INDEX "ManualStatementUpload_bankAccountId_status_idx" ON "ManualStatementUpload"("bankAccountId", "status");

-- AddForeignKey
ALTER TABLE "ManualStatementUpload" ADD CONSTRAINT "ManualStatementUpload_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualStatementUpload" ADD CONSTRAINT "ManualStatementUpload_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualStatementUpload" ADD CONSTRAINT "ManualStatementUpload_bankAccountId_fkey" FOREIGN KEY ("bankAccountId") REFERENCES "BankAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualStatementUpload" ADD CONSTRAINT "ManualStatementUpload_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
