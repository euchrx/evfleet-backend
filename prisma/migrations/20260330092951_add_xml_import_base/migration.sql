-- CreateEnum
CREATE TYPE "XmlImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE "XmlInvoiceStatus" AS ENUM ('AUTHORIZED', 'CANCELED', 'DENIED', 'UNKNOWN');

-- CreateTable
CREATE TABLE "XmlImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "periodLabel" TEXT,
    "status" "XmlImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "totalFiles" INTEGER NOT NULL DEFAULT 0,
    "importedFiles" INTEGER NOT NULL DEFAULT 0,
    "duplicateFiles" INTEGER NOT NULL DEFAULT 0,
    "errorFiles" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "XmlImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XmlInvoice" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "folderName" TEXT,
    "invoiceKey" TEXT NOT NULL,
    "number" TEXT,
    "series" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuerName" TEXT,
    "issuerDocument" TEXT,
    "recipientName" TEXT,
    "recipientDocument" TEXT,
    "totalAmount" DECIMAL(14,2),
    "protocolNumber" TEXT,
    "invoiceStatus" "XmlInvoiceStatus" NOT NULL DEFAULT 'UNKNOWN',
    "rawXml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "XmlInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XmlInvoiceItem" (
    "id" TEXT NOT NULL,
    "productCode" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(14,4),
    "unitValue" DECIMAL(14,4),
    "totalValue" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "invoiceId" TEXT NOT NULL,

    CONSTRAINT "XmlInvoiceItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "XmlImportBatch_companyId_idx" ON "XmlImportBatch"("companyId");

-- CreateIndex
CREATE INDEX "XmlImportBatch_branchId_idx" ON "XmlImportBatch"("branchId");

-- CreateIndex
CREATE INDEX "XmlImportBatch_status_idx" ON "XmlImportBatch"("status");

-- CreateIndex
CREATE INDEX "XmlImportBatch_createdAt_idx" ON "XmlImportBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "XmlInvoice_invoiceKey_key" ON "XmlInvoice"("invoiceKey");

-- CreateIndex
CREATE INDEX "XmlInvoice_batchId_idx" ON "XmlInvoice"("batchId");

-- CreateIndex
CREATE INDEX "XmlInvoice_companyId_idx" ON "XmlInvoice"("companyId");

-- CreateIndex
CREATE INDEX "XmlInvoice_branchId_idx" ON "XmlInvoice"("branchId");

-- CreateIndex
CREATE INDEX "XmlInvoice_issuedAt_idx" ON "XmlInvoice"("issuedAt");

-- CreateIndex
CREATE INDEX "XmlInvoiceItem_invoiceId_idx" ON "XmlInvoiceItem"("invoiceId");

-- AddForeignKey
ALTER TABLE "XmlImportBatch" ADD CONSTRAINT "XmlImportBatch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlImportBatch" ADD CONSTRAINT "XmlImportBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlInvoice" ADD CONSTRAINT "XmlInvoice_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "XmlImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlInvoice" ADD CONSTRAINT "XmlInvoice_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlInvoice" ADD CONSTRAINT "XmlInvoice_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "XmlInvoiceItem" ADD CONSTRAINT "XmlInvoiceItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "XmlInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
