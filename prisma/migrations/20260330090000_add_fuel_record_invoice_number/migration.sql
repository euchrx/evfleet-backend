ALTER TABLE "FuelRecord"
ADD COLUMN "invoiceNumber" TEXT;

CREATE UNIQUE INDEX "FuelRecord_invoiceNumber_key"
ON "FuelRecord"("invoiceNumber");
