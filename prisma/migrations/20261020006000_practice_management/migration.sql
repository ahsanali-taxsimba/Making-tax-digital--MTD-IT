-- AlterEnum
ALTER TYPE "UserRole" ADD VALUE 'ASSISTANT';

-- AlterEnum
ALTER TYPE "TaskStatus" ADD VALUE 'WAITING_ON_CLIENT';

-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE 'VAT_RETURN';
ALTER TYPE "TaskType" ADD VALUE 'ITSA_UPDATE';
ALTER TYPE "TaskType" ADD VALUE 'EOPS';
ALTER TYPE "TaskType" ADD VALUE 'FINAL_DECLARATION';
ALTER TYPE "TaskType" ADD VALUE 'BOOKKEEPING';
ALTER TYPE "TaskType" ADD VALUE 'RECONCILIATION';

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');

-- AlterTable
ALTER TABLE "Client" ADD COLUMN "riskLevel" "RiskLevel" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "Client" ADD COLUMN "assignedUserId" TEXT;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "Client_assignedUserId_idx" ON "Client"("assignedUserId");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_firmId_status_idx" ON "Task"("firmId", "status");

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_assignedUserId_fkey" FOREIGN KEY ("assignedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
