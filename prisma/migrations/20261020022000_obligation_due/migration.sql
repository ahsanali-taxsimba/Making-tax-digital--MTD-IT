-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'OBLIGATION_DUE';

-- AlterTable
ALTER TABLE "VatObligation" ADD COLUMN "dueNotifiedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ItsaObligation" ADD COLUMN "dueNotifiedAt" TIMESTAMP(3);
