-- AlterTable
ALTER TABLE "Client" ADD COLUMN "vatRegion" TEXT NOT NULL DEFAULT 'GB';

-- AlterTable
ALTER TABLE "VatReturn" ADD COLUMN "periodStart" TIMESTAMP(3);
ALTER TABLE "VatReturn" ADD COLUMN "periodEnd" TIMESTAMP(3);

UPDATE "VatReturn" AS ret
SET
  "periodStart" = obl.start,
  "periodEnd" = obl."end"
FROM "VatObligation" AS obl
WHERE ret."obligationId" = obl.id
  AND ret."periodStart" IS NULL;

-- CreateTable
CREATE TABLE "VatTransactionSummary" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "periodKey" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "box1" DECIMAL(14,2) NOT NULL,
    "box2" DECIMAL(14,2) NOT NULL,
    "box3" DECIMAL(14,2) NOT NULL,
    "box4" DECIMAL(14,2) NOT NULL,
    "box5" DECIMAL(14,2) NOT NULL,
    "box6" DECIMAL(14,2) NOT NULL,
    "box7" DECIMAL(14,2) NOT NULL,
    "box8" DECIMAL(14,2) NOT NULL,
    "box9" DECIMAL(14,2) NOT NULL,
    "transactionCount" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "excluded" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VatTransactionSummary_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VatTransactionSummary_clientId_periodStart_periodEnd_key" ON "VatTransactionSummary"("clientId", "periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "VatTransactionSummary_clientId_idx" ON "VatTransactionSummary"("clientId");

-- AddForeignKey
ALTER TABLE "VatTransactionSummary" ADD CONSTRAINT "VatTransactionSummary_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
