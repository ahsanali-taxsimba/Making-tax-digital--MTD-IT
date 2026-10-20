ALTER TABLE "ReceiptFile" ADD COLUMN "ocrSupplierName" TEXT;
ALTER TABLE "ReceiptFile" ADD COLUMN "ocrNetAmount" DECIMAL(14,2);
ALTER TABLE "ReceiptFile" ADD COLUMN "ocrVatAmount" DECIMAL(14,2);
ALTER TABLE "ReceiptFile" ADD COLUMN "ocrVatRate" DECIMAL(5,2);
ALTER TABLE "ReceiptFile" ADD COLUMN "ocrInvoiceNumber" TEXT;
