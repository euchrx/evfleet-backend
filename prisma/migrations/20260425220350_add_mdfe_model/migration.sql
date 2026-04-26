-- CreateEnum
CREATE TYPE "MdfeStatus" AS ENUM ('DRAFT', 'PROCESSING', 'AUTHORIZED', 'REJECTED', 'CANCELED', 'CLOSED', 'ERROR');

-- CreateTable
CREATE TABLE "Mdfe" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "environment" "FiscalEnvironment" NOT NULL,
    "status" "MdfeStatus" NOT NULL DEFAULT 'DRAFT',
    "accessKey" TEXT,
    "protocol" TEXT,
    "series" INTEGER NOT NULL,
    "number" INTEGER NOT NULL,
    "requestXml" TEXT,
    "authorizedXml" TEXT,
    "responseXml" TEXT,
    "rejectionCode" TEXT,
    "rejectionReason" TEXT,
    "issuedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Mdfe_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Mdfe_tripId_key" ON "Mdfe"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "Mdfe_accessKey_key" ON "Mdfe"("accessKey");

-- CreateIndex
CREATE INDEX "Mdfe_companyId_idx" ON "Mdfe"("companyId");

-- CreateIndex
CREATE INDEX "Mdfe_status_idx" ON "Mdfe"("status");

-- AddForeignKey
ALTER TABLE "Mdfe" ADD CONSTRAINT "Mdfe_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mdfe" ADD CONSTRAINT "Mdfe_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripUsage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
