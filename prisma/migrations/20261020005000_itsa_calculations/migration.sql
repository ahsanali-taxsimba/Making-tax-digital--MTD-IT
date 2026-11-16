-- CreateTable
CREATE TABLE "ItsaCalculation" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "taxYear" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "calculationType" TEXT NOT NULL DEFAULT 'intent-to-finalise',
    "status" TEXT NOT NULL DEFAULT 'TRIGGERED',
    "taxDue" DECIMAL(14,2),
    "correlationId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItsaCalculation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ItsaCalculation_clientId_taxYear_idx" ON "ItsaCalculation"("clientId", "taxYear");

-- AddForeignKey
ALTER TABLE "ItsaCalculation" ADD CONSTRAINT "ItsaCalculation_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
