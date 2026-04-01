ALTER TYPE "FuelType" ADD VALUE IF NOT EXISTS 'ARLA32';

DROP INDEX IF EXISTS "FuelRecord_invoiceNumber_key";

ALTER TABLE "FuelRecord"
ADD COLUMN "sourceInvoiceKey" TEXT,
ADD COLUMN "sourceInvoiceLineIndex" INTEGER,
ADD COLUMN "sourceProductCode" TEXT,
ADD COLUMN "sourcePlate" TEXT,
ADD COLUMN "sourceFuelDateTime" TIMESTAMP(3);

CREATE INDEX "FuelRecord_invoiceNumber_idx" ON "FuelRecord"("invoiceNumber");
CREATE INDEX "FuelRecord_sourceInvoiceKey_sourceInvoiceLineIndex_idx"
ON "FuelRecord"("sourceInvoiceKey", "sourceInvoiceLineIndex");

CREATE UNIQUE INDEX "FuelRecord_sourceInvoiceKey_sourceInvoiceLineIndex_sourceProductCode_key"
ON "FuelRecord"("sourceInvoiceKey", "sourceInvoiceLineIndex", "sourceProductCode");
