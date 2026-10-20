-- AlterTable
ALTER TABLE "HmrcSandboxTestUser" ADD COLUMN "firmId" TEXT;

-- AlterTable
ALTER TABLE "YapilyConnection" ADD COLUMN "callbackState" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AuditLog_firmId_prevHash_key" ON "AuditLog"("firmId", "prevHash");

-- CreateIndex
CREATE INDEX "HmrcSandboxTestUser_firmId_idx" ON "HmrcSandboxTestUser"("firmId");

-- CreateIndex
CREATE UNIQUE INDEX "YapilyConnection_callbackState_key" ON "YapilyConnection"("callbackState");

-- AddForeignKey
ALTER TABLE "HmrcSandboxTestUser" ADD CONSTRAINT "HmrcSandboxTestUser_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE SET NULL ON UPDATE CASCADE;
