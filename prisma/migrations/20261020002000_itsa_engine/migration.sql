-- CreateTable
CREATE TABLE "ItsaAccountMapping" (
    "id" TEXT NOT NULL,
    "profile" "ChartProfile" NOT NULL,
    "code" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hmrcKey" TEXT NOT NULL,
    "includedInQuarterlyUpdate" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItsaAccountMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItsaAccountMapping_profile_code_key" ON "ItsaAccountMapping"("profile", "code");

-- CreateIndex
CREATE INDEX "ItsaAccountMapping_profile_idx" ON "ItsaAccountMapping"("profile");
