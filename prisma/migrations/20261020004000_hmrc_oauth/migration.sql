-- AlterTable
ALTER TABLE "MtdConnection" ADD COLUMN "disconnectedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "HmrcAppConfig" (
    "id" TEXT NOT NULL,
    "environment" "HmrcEnvironment" NOT NULL,
    "clientId" TEXT NOT NULL,
    "clientSecretEnc" TEXT NOT NULL,
    "redirectUri" TEXT NOT NULL,
    "baseUrl" TEXT NOT NULL,
    "authBaseUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HmrcAppConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HmrcAppConfig_environment_key" ON "HmrcAppConfig"("environment");
