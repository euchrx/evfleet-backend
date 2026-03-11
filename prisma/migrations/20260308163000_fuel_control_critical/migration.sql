-- AlterTable
ALTER TABLE "FuelRecord"
ADD COLUMN "fuelType" "FuelType" NOT NULL DEFAULT 'DIESEL',
ADD COLUMN "averageConsumptionKmPerLiter" DOUBLE PRECISION,
ADD COLUMN "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "anomalyReason" TEXT,
ADD COLUMN "driverId" TEXT;

-- CreateIndex
CREATE INDEX "FuelRecord_driverId_idx" ON "FuelRecord"("driverId");

-- CreateIndex
CREATE INDEX "FuelRecord_isAnomaly_idx" ON "FuelRecord"("isAnomaly");

-- AddForeignKey
ALTER TABLE "FuelRecord"
ADD CONSTRAINT "FuelRecord_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
