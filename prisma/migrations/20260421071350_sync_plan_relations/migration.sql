/*
  Warnings:

  - You are about to drop the column `allowsCustomPrice` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `allowsCustomVehicleLimit` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `defaultGraceDays` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `defaultTrialDays` on the `Plan` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Plan` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX IF EXISTS "Plan_isActive_idx";

-- DropIndex
DROP INDEX IF EXISTS "Plan_isEnterprise_idx";

-- DropIndex
DROP INDEX IF EXISTS "Plan_isPublic_idx";

-- DropIndex
DROP INDEX IF EXISTS "Plan_sortOrder_idx";

-- AlterTable
ALTER TABLE "Plan" DROP COLUMN "allowsCustomPrice",
DROP COLUMN "allowsCustomVehicleLimit",
DROP COLUMN "defaultGraceDays",
DROP COLUMN "defaultTrialDays",
DROP COLUMN "isActive",
ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "ctaLabel" TEXT,
ADD COLUMN     "features" JSONB,
ADD COLUMN     "highlightLabel" TEXT,
ADD COLUMN     "trialDays" INTEGER,
ADD COLUMN     "userLimit" INTEGER;

-- CreateIndex
CREATE INDEX "Plan_active_idx" ON "Plan"("active");

-- CreateIndex
CREATE INDEX "Plan_companyId_idx" ON "Plan"("companyId");

-- CreateIndex
CREATE INDEX "Plan_isPublic_active_idx" ON "Plan"("isPublic", "active");

-- CreateIndex
CREATE INDEX "Plan_isEnterprise_companyId_active_idx" ON "Plan"("isEnterprise", "companyId", "active");

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
