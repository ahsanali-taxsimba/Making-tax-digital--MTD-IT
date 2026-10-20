-- AlterEnum
ALTER TYPE "TaskType" ADD VALUE 'PROVIDE_RECORDS';
ALTER TYPE "TaskType" ADD VALUE 'APPROVE_RETURN';

-- CreateEnum
CREATE TYPE "EvidenceStatus" AS ENUM ('PENDING', 'USED');

-- AlterTable
ALTER TABLE "SupportingDocument" ADD COLUMN "category" TEXT;
ALTER TABLE "SupportingDocument" ADD COLUMN "status" "EvidenceStatus" NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "ClientMessage" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "authorRole" "UserRole" NOT NULL,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClientMessage_clientId_createdAt_idx" ON "ClientMessage"("clientId", "createdAt");

-- AddForeignKey
ALTER TABLE "ClientMessage" ADD CONSTRAINT "ClientMessage_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
