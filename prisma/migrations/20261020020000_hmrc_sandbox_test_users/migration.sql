-- CreateEnum
CREATE TYPE "HmrcTestUserKind" AS ENUM ('ORGANISATION', 'INDIVIDUAL');

-- CreateTable
CREATE TABLE "HmrcSandboxTestUser" (
    "id" TEXT NOT NULL,
    "kind" "HmrcTestUserKind" NOT NULL,
    "hmrcUserId" TEXT NOT NULL,
    "passwordEnc" TEXT NOT NULL,
    "vrn" TEXT,
    "nino" TEXT,
    "saUtr" TEXT,
    "mtdItId" TEXT,
    "ctUtr" TEXT,
    "eoriNumber" TEXT,
    "services" TEXT[],
    "clientId" TEXT,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HmrcSandboxTestUser_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HmrcSandboxTestUser_kind_idx" ON "HmrcSandboxTestUser"("kind");

-- CreateIndex
CREATE INDEX "HmrcSandboxTestUser_clientId_idx" ON "HmrcSandboxTestUser"("clientId");
