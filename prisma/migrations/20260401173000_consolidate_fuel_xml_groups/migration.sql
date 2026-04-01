ALTER TABLE "FuelRecord"
ADD COLUMN "sourceItems" JSONB;

DROP INDEX IF EXISTS "FuelRecord_sourceInvoiceKey_sourceInvoiceLineIndex_sourceProductC_key";

CREATE INDEX "FuelRecord_sourceInvoiceKey_sourcePlate_fuelType_idx"
ON "FuelRecord"("sourceInvoiceKey", "sourcePlate", "fuelType");

CREATE UNIQUE INDEX "FuelRecord_sourceInvoiceKey_sourcePlate_fuelType_key"
ON "FuelRecord"("sourceInvoiceKey", "sourcePlate", "fuelType");
