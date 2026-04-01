ALTER TABLE "RetailProductImport"
ADD COLUMN "sourceInvoiceKey" TEXT,
ALTER COLUMN "xmlInvoiceId" DROP NOT NULL;

ALTER TABLE "RetailProductImportItem"
ADD COLUMN "category" TEXT,
ADD COLUMN "sourceInvoiceKey" TEXT,
ADD COLUMN "sourceInvoiceLineIndex" INTEGER,
ADD COLUMN "sourceProductCode" TEXT;

CREATE INDEX "RetailProductImport_sourceInvoiceKey_idx"
ON "RetailProductImport"("sourceInvoiceKey");

CREATE INDEX "RetailProductImportItem_sourceInvoiceKey_sourceInvoiceLineIn_idx"
ON "RetailProductImportItem"("sourceInvoiceKey", "sourceInvoiceLineIndex");

CREATE UNIQUE INDEX "RetailProductImportItem_sourceInvoiceKey_sourceInvoiceL_key"
ON "RetailProductImportItem"("sourceInvoiceKey", "sourceInvoiceLineIndex", "sourceProductCode");
