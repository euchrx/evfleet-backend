-- AlterTable
ALTER TABLE "public"."XmlInvoice"
ADD COLUMN IF NOT EXISTS "linkedFuelRecordId" TEXT,
ADD COLUMN IF NOT EXISTS "linkedMaintenanceRecordId" TEXT,
ADD COLUMN IF NOT EXISTS "linkedCostId" TEXT;

-- AlterTable
ALTER TABLE "public"."FuelRecord"
ALTER COLUMN "vehicleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."MaintenanceRecord"
ALTER COLUMN "vehicleId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "public"."Debt"
ALTER COLUMN "vehicleId" DROP NOT NULL;

-- DropForeignKey
ALTER TABLE "public"."FuelRecord" DROP CONSTRAINT IF EXISTS "FuelRecord_vehicleId_fkey";

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'FuelRecord_vehicleId_fkey'
  ) THEN
    ALTER TABLE "public"."FuelRecord"
    ADD CONSTRAINT "FuelRecord_vehicleId_fkey"
    FOREIGN KEY ("vehicleId")
    REFERENCES "public"."Vehicle"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "public"."MaintenanceRecord" DROP CONSTRAINT IF EXISTS "MaintenanceRecord_vehicleId_fkey";

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'MaintenanceRecord_vehicleId_fkey'
  ) THEN
    ALTER TABLE "public"."MaintenanceRecord"
    ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey"
    FOREIGN KEY ("vehicleId")
    REFERENCES "public"."Vehicle"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- DropForeignKey
ALTER TABLE "public"."Debt" DROP CONSTRAINT IF EXISTS "Debt_vehicleId_fkey";

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Debt_vehicleId_fkey'
  ) THEN
    ALTER TABLE "public"."Debt"
    ADD CONSTRAINT "Debt_vehicleId_fkey"
    FOREIGN KEY ("vehicleId")
    REFERENCES "public"."Vehicle"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_linkedFuelRecordId_idx" ON "public"."XmlInvoice"("linkedFuelRecordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_linkedMaintenanceRecordId_idx" ON "public"."XmlInvoice"("linkedMaintenanceRecordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_linkedCostId_idx" ON "public"."XmlInvoice"("linkedCostId");
