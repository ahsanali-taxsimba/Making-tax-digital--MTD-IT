-- CreateEnum
CREATE TYPE "PlatformRole" AS ENUM ('ADMIN_SUPER', 'ADMIN_OWNER', 'ADMIN_MARKETING', 'ADMIN_DEVELOPER', 'ADMIN_SUPPORT');

-- CreateEnum
CREATE TYPE "FirmRole" AS ENUM ('FIRM_ADMIN', 'FIRM_ACCOUNTANT', 'FIRM_STAFF', 'FIRM_CLIENT');

-- CreateEnum
CREATE TYPE "AccountantScope" AS ENUM ('ALL', 'ASSIGNED');

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN "slug" TEXT;
ALTER TABLE "Firm" ADD COLUMN "subscriptionPlan" TEXT NOT NULL DEFAULT 'starter';
ALTER TABLE "Firm" ADD COLUMN "accountantScope" "AccountantScope" NOT NULL DEFAULT 'ALL';

UPDATE "Firm"
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g')) || '-' || substr(id::text, 1, 8)
WHERE slug IS NULL;

ALTER TABLE "Firm" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Firm_slug_key" ON "Firm"("slug");

-- CreateTable
CREATE TABLE "PlatformUser" (
    "id" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "passwordHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformUser_email_key" ON "PlatformUser"("email");

CREATE TABLE "PlatformRefreshToken" (
    "id" TEXT NOT NULL,
    "platformUserId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlatformRefreshToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlatformRefreshToken_tokenHash_key" ON "PlatformRefreshToken"("tokenHash");

ALTER TABLE "PlatformRefreshToken" ADD CONSTRAINT "PlatformRefreshToken_platformUserId_fkey" FOREIGN KEY ("platformUserId") REFERENCES "PlatformUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FeatureFlag_key_key" ON "FeatureFlag"("key");
