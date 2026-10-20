-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('UPLOADED', 'PROCESSED');

-- CreateTable
CREATE TABLE "ReceiptTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceiptTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptFile" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "bankTransactionId" TEXT,
    "invoiceId" TEXT,
    "billId" TEXT,
    "journalEntryId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageUrl" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tags" JSONB NOT NULL DEFAULT '[]',
    "ocrText" TEXT,
    "ocrMerchant" TEXT,
    "ocrAmount" DECIMAL(14,2),
    "ocrDate" TIMESTAMP(3),
    "status" "ReceiptStatus" NOT NULL DEFAULT 'UPLOADED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReceiptFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceiptFileOnTag" (
    "receiptId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "ReceiptFileOnTag_pkey" PRIMARY KEY ("receiptId","tagId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReceiptTag_name_key" ON "ReceiptTag"("name");

-- CreateIndex
CREATE INDEX "ReceiptFile_clientId_uploadedAt_idx" ON "ReceiptFile"("clientId", "uploadedAt");

-- CreateIndex
CREATE INDEX "ReceiptFile_bankTransactionId_idx" ON "ReceiptFile"("bankTransactionId");

-- CreateIndex
CREATE INDEX "ReceiptFile_invoiceId_idx" ON "ReceiptFile"("invoiceId");

-- CreateIndex
CREATE INDEX "ReceiptFile_billId_idx" ON "ReceiptFile"("billId");

-- CreateIndex
CREATE INDEX "ReceiptFile_journalEntryId_idx" ON "ReceiptFile"("journalEntryId");

-- AddForeignKey
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "BankTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "SalesInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_billId_fkey" FOREIGN KEY ("billId") REFERENCES "PurchaseBill"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceiptFile" ADD CONSTRAINT "ReceiptFile_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ReceiptFileOnTag" ADD CONSTRAINT "ReceiptFileOnTag_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "ReceiptFile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceiptFileOnTag" ADD CONSTRAINT "ReceiptFileOnTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ReceiptTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ReceiptTag" ("id", "name", "description") VALUES
  ('tag-fuel', 'Fuel', 'Motor fuel and charging'),
  ('tag-office', 'Office', 'Office costs and stationery'),
  ('tag-travel', 'Travel', 'Travel and subsistence'),
  ('tag-meals', 'Meals', 'Client or staff meals'),
  ('tag-professional', 'Professional', 'Accountancy and legal fees'),
  ('tag-advertising', 'Advertising', 'Ads and promotion'),
  ('tag-utilities', 'Utilities', 'Power, phone and internet'),
  ('tag-insurance', 'Insurance', 'Business insurance');
