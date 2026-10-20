-- CreateEnum
CREATE TYPE "ExtractionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "DocumentFile" ADD COLUMN "extractedData" JSONB,
ADD COLUMN "extractionStatus" "ExtractionStatus" NOT NULL DEFAULT 'NOT_STARTED',
ADD COLUMN "extractionConfidence" DECIMAL(4,3);

-- AlterTable
ALTER TABLE "SalesInvoice" ADD COLUMN "invoiceNumber" TEXT;

-- AlterTable
ALTER TABLE "PurchaseBill" ADD COLUMN "invoiceNumber" TEXT;

-- CreateTable
CREATE TABLE "InvoiceExtractionLog" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "status" "ExtractionStatus" NOT NULL,
    "confidence" DECIMAL(4,3),
    "extractedData" JSONB NOT NULL,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceExtractionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InvoiceExtractionLog_documentId_createdAt_idx" ON "InvoiceExtractionLog"("documentId", "createdAt");

-- AddForeignKey
ALTER TABLE "InvoiceExtractionLog" ADD CONSTRAINT "InvoiceExtractionLog_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
