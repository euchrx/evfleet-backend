-- AlterTable
ALTER TABLE "public"."XmlInvoice"
ADD COLUMN "linkedFuelRecordId" TEXT,
ADD COLUMN "linkedMaintenanceRecordId" TEXT,
ADD COLUMN "linkedCostId" TEXT;

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
ALTER TABLE "public"."FuelRecord" DROP CONSTRAINT "FuelRecord_vehicleId_fkey";

-- AddForeignKey
ALTER TABLE "public"."FuelRecord"
ADD CONSTRAINT "FuelRecord_vehicleId_fkey"
FOREIGN KEY ("vehicleId")
REFERENCES "public"."Vehicle"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "public"."MaintenanceRecord" DROP CONSTRAINT "MaintenanceRecord_vehicleId_fkey";

-- AddForeignKey
ALTER TABLE "public"."MaintenanceRecord"
ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey"
FOREIGN KEY ("vehicleId")
REFERENCES "public"."Vehicle"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "public"."Debt" DROP CONSTRAINT "Debt_vehicleId_fkey";

-- AddForeignKey
ALTER TABLE "public"."Debt"
ADD CONSTRAINT "Debt_vehicleId_fkey"
FOREIGN KEY ("vehicleId")
REFERENCES "public"."Vehicle"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "XmlInvoice_linkedFuelRecordId_idx" ON "public"."XmlInvoice"("linkedFuelRecordId");

-- CreateIndex
CREATE INDEX "XmlInvoice_linkedMaintenanceRecordId_idx" ON "public"."XmlInvoice"("linkedMaintenanceRecordId");

-- CreateIndex
CREATE INDEX "XmlInvoice_linkedCostId_idx" ON "public"."XmlInvoice"("linkedCostId");
