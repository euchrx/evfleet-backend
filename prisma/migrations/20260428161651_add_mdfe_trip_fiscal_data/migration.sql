-- CreateEnum
CREATE TYPE "TripFiscalDocumentType" AS ENUM ('CTE', 'NFE');

-- CreateEnum
CREATE TYPE "MdfeCargoUnit" AS ENUM ('KG', 'TON');

-- CreateEnum
CREATE TYPE "MdfePaymentIndicator" AS ENUM ('PAID', 'UNPAID');

-- AlterTable
ALTER TABLE "CompanyFiscalSettings" ADD COLUMN     "mdfeDefaultInsurerDocument" TEXT,
ADD COLUMN     "mdfeDefaultInsurerName" TEXT,
ADD COLUMN     "mdfeDefaultPolicyNumber" TEXT,
ADD COLUMN     "mdfePaymentPixKey" TEXT,
ADD COLUMN     "rntrc" TEXT;

-- AlterTable
ALTER TABLE "TripUsage" ADD COLUMN     "cargoDescription" TEXT,
ADD COLUMN     "cargoNcm" TEXT,
ADD COLUMN     "cargoQuantity" DECIMAL(14,4),
ADD COLUMN     "cargoUnit" "MdfeCargoUnit" DEFAULT 'KG',
ADD COLUMN     "cargoValue" DECIMAL(14,2),
ADD COLUMN     "contractorDocument" TEXT,
ADD COLUMN     "contractorName" TEXT,
ADD COLUMN     "destinationCityIbgeCode" TEXT,
ADD COLUMN     "destinationCityName" TEXT,
ADD COLUMN     "destinationState" TEXT,
ADD COLUMN     "destinationZipCode" TEXT,
ADD COLUMN     "insuranceCompanyDocument" TEXT,
ADD COLUMN     "insuranceCompanyName" TEXT,
ADD COLUMN     "insuranceEndorsement" TEXT,
ADD COLUMN     "insurancePolicyNumber" TEXT,
ADD COLUMN     "originCityIbgeCode" TEXT,
ADD COLUMN     "originCityName" TEXT,
ADD COLUMN     "originState" TEXT,
ADD COLUMN     "originZipCode" TEXT,
ADD COLUMN     "paymentIndicator" "MdfePaymentIndicator" DEFAULT 'UNPAID',
ADD COLUMN     "paymentPixKey" TEXT,
ADD COLUMN     "paymentValue" DECIMAL(14,2);

-- CreateTable
CREATE TABLE "TripFiscalDocument" (
    "id" TEXT NOT NULL,
    "type" "TripFiscalDocumentType" NOT NULL,
    "accessKey" TEXT NOT NULL,
    "number" TEXT,
    "series" TEXT,
    "issuedAt" TIMESTAMP(3),
    "issuerName" TEXT,
    "issuerDocument" TEXT,
    "totalValue" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tripId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "TripFiscalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TripFiscalDocument_tripId_idx" ON "TripFiscalDocument"("tripId");

-- CreateIndex
CREATE INDEX "TripFiscalDocument_companyId_idx" ON "TripFiscalDocument"("companyId");

-- CreateIndex
CREATE INDEX "TripFiscalDocument_type_idx" ON "TripFiscalDocument"("type");

-- CreateIndex
CREATE INDEX "TripFiscalDocument_accessKey_idx" ON "TripFiscalDocument"("accessKey");

-- CreateIndex
CREATE UNIQUE INDEX "TripFiscalDocument_tripId_accessKey_key" ON "TripFiscalDocument"("tripId", "accessKey");

-- CreateIndex
CREATE INDEX "TripUsage_originState_idx" ON "TripUsage"("originState");

-- CreateIndex
CREATE INDEX "TripUsage_destinationState_idx" ON "TripUsage"("destinationState");

-- AddForeignKey
ALTER TABLE "TripFiscalDocument" ADD CONSTRAINT "TripFiscalDocument_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripUsage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripFiscalDocument" ADD CONSTRAINT "TripFiscalDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
