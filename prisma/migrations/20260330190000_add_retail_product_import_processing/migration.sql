ALTER TABLE "XmlInvoice"
ADD COLUMN IF NOT EXISTS "linkedRetailProductImportId" TEXT;

CREATE TABLE IF NOT EXISTS "RetailProductImport" (
  "id" TEXT NOT NULL,
  "supplierName" TEXT,
  "supplierDocument" TEXT,
  "invoiceNumber" TEXT,
  "invoiceSeries" TEXT,
  "issuedAt" TIMESTAMP(3),
  "totalAmount" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "companyId" TEXT NOT NULL,
  "branchId" TEXT,
  "xmlInvoiceId" TEXT NOT NULL,
  CONSTRAINT "RetailProductImport_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "RetailProductImport_xmlInvoiceId_key" UNIQUE ("xmlInvoiceId")
);

CREATE TABLE IF NOT EXISTS "RetailProductImportItem" (
  "id" TEXT NOT NULL,
  "productCode" TEXT,
  "description" TEXT NOT NULL,
  "quantity" DECIMAL(14,4),
  "unitValue" DECIMAL(14,4),
  "totalValue" DECIMAL(14,2),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "retailProductImportId" TEXT NOT NULL,
  CONSTRAINT "RetailProductImportItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "XmlInvoice_linkedRetailProductImportId_idx"
ON "XmlInvoice"("linkedRetailProductImportId");

CREATE INDEX IF NOT EXISTS "RetailProductImport_companyId_idx"
ON "RetailProductImport"("companyId");

CREATE INDEX IF NOT EXISTS "RetailProductImport_branchId_idx"
ON "RetailProductImport"("branchId");

CREATE INDEX IF NOT EXISTS "RetailProductImport_issuedAt_idx"
ON "RetailProductImport"("issuedAt");

CREATE INDEX IF NOT EXISTS "RetailProductImportItem_retailProductImportId_idx"
ON "RetailProductImportItem"("retailProductImportId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetailProductImport_companyId_fkey'
  ) THEN
    ALTER TABLE "RetailProductImport"
    ADD CONSTRAINT "RetailProductImport_companyId_fkey"
    FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetailProductImport_branchId_fkey'
  ) THEN
    ALTER TABLE "RetailProductImport"
    ADD CONSTRAINT "RetailProductImport_branchId_fkey"
    FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetailProductImport_xmlInvoiceId_fkey'
  ) THEN
    ALTER TABLE "RetailProductImport"
    ADD CONSTRAINT "RetailProductImport_xmlInvoiceId_fkey"
    FOREIGN KEY ("xmlInvoiceId") REFERENCES "XmlInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'RetailProductImportItem_retailProductImportId_fkey'
  ) THEN
    ALTER TABLE "RetailProductImportItem"
    ADD CONSTRAINT "RetailProductImportItem_retailProductImportId_fkey"
    FOREIGN KEY ("retailProductImportId") REFERENCES "RetailProductImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;
