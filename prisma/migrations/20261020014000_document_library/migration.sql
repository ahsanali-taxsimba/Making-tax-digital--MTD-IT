-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('RECEIPT', 'INVOICE', 'BILL', 'CONTRACT', 'STATEMENT', 'HMRC_LETTER');

-- CreateTable
CREATE TABLE "DocumentTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFile" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "type" "DocumentKind" NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "ocrText" TEXT,
    "ocrMerchant" TEXT,
    "ocrAmount" DECIMAL(14,2),
    "ocrDate" TIMESTAMP(3),
    "ocrInvoiceNumber" TEXT,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "attachedTo" JSONB NOT NULL DEFAULT '{}',
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bankTransactionId" TEXT,
    "invoiceId" TEXT,
    "billId" TEXT,
    "journalEntryId" TEXT,
    "vatReturnId" TEXT,
    "itsaSubmissionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentFileOnTag" (
    "documentId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "DocumentFileOnTag_pkey" PRIMARY KEY ("documentId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "DocumentTag_name_key" ON "DocumentTag"("name");

-- CreateIndex
CREATE INDEX "DocumentFile_clientId_uploadedAt_idx" ON "DocumentFile"("clientId", "uploadedAt");

-- CreateIndex
CREATE INDEX "DocumentFile_clientId_type_idx" ON "DocumentFile"("clientId", "type");

-- CreateIndex
CREATE INDEX "DocumentFile_bankTransactionId_idx" ON "DocumentFile"("bankTransactionId");

-- CreateIndex
CREATE INDEX "DocumentFile_invoiceId_idx" ON "DocumentFile"("invoiceId");

-- CreateIndex
CREATE INDEX "DocumentFile_billId_idx" ON "DocumentFile"("billId");

-- CreateIndex
CREATE INDEX "DocumentFile_journalEntryId_idx" ON "DocumentFile"("journalEntryId");

-- CreateIndex
CREATE INDEX "DocumentFile_vatReturnId_idx" ON "DocumentFile"("vatReturnId");

-- CreateIndex
CREATE INDEX "DocumentFile_itsaSubmissionId_idx" ON "DocumentFile"("itsaSubmissionId");

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_vatReturnId_fkey" FOREIGN KEY ("vatReturnId") REFERENCES "VatReturn"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFile" ADD CONSTRAINT "DocumentFile_itsaSubmissionId_fkey" FOREIGN KEY ("itsaSubmissionId") REFERENCES "ItsaUpdate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFileOnTag" ADD CONSTRAINT "DocumentFileOnTag_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "DocumentFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentFileOnTag" ADD CONSTRAINT "DocumentFileOnTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "DocumentTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
