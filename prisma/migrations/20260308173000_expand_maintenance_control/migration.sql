-- AlterTable
ALTER TABLE "MaintenanceRecord"
ADD COLUMN "partsReplaced" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "workshop" TEXT,
ADD COLUMN "responsible" TEXT;

-- AlterTable
ALTER TABLE "MaintenancePlan"
ADD COLUMN "alertBeforeKm" INTEGER DEFAULT 500,
ADD COLUMN "alertBeforeDays" INTEGER DEFAULT 7;
