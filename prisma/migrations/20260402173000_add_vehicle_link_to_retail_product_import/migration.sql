ALTER TABLE "RetailProductImport"
ADD COLUMN "sourcePlate" TEXT,
ADD COLUMN "vehicleId" TEXT;

ALTER TABLE "RetailProductImport"
ADD CONSTRAINT "RetailProductImport_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "RetailProductImport_vehicleId_idx"
ON "RetailProductImport"("vehicleId");

CREATE INDEX "RetailProductImport_sourcePlate_idx"
ON "RetailProductImport"("sourcePlate");
