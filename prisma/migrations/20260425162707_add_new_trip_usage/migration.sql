/*
  Warnings:

  - The `status` column on the `TripUsage` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'PENDING_COMPLIANCE', 'BLOCKED', 'APPROVED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'OPEN');

-- CreateEnum
CREATE TYPE "ComplianceStatus" AS ENUM ('APPROVED', 'BLOCKED', 'WARNING');

-- CreateEnum
CREATE TYPE "ComplianceSeverity" AS ENUM ('INFO', 'WARNING', 'BLOCKING');

-- CreateEnum
CREATE TYPE "GeneratedDocumentType" AS ENUM ('EMERGENCY_SHEET', 'FISPQ', 'MDFE_MOCK', 'CHECKLIST');

-- CreateEnum
CREATE TYPE "GeneratedDocumentStatus" AS ENUM ('DRAFT', 'GENERATED', 'SENT', 'CANCELLED', 'ERROR');

-- AlterTable
ALTER TABLE "TripUsage" ADD COLUMN     "branchId" TEXT,
ADD COLUMN     "companyId" TEXT,
DROP COLUMN "status",
ADD COLUMN     "status" "TripStatus" NOT NULL DEFAULT 'DRAFT';

-- CreateTable
CREATE TABLE "DangerousProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "commercialName" TEXT,
    "unNumber" TEXT NOT NULL,
    "riskClass" TEXT NOT NULL,
    "packingGroup" TEXT,
    "hazardNumber" TEXT,
    "emergencyNumber" TEXT,
    "physicalState" TEXT,
    "emergencyInstructions" JSONB,
    "fispqUrl" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "DangerousProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripProduct" (
    "id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "unit" TEXT NOT NULL,
    "tankCompartment" TEXT,
    "invoiceKey" TEXT,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tripId" TEXT NOT NULL,
    "dangerousProductId" TEXT NOT NULL,

    CONSTRAINT "TripProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripComplianceCheck" (
    "id" TEXT NOT NULL,
    "status" "ComplianceStatus" NOT NULL,
    "summary" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkedByUserId" TEXT,
    "tripId" TEXT NOT NULL,

    CONSTRAINT "TripComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripComplianceResult" (
    "id" TEXT NOT NULL,
    "ruleCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "severity" "ComplianceSeverity" NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkId" TEXT NOT NULL,

    CONSTRAINT "TripComplianceResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripGeneratedDocument" (
    "id" TEXT NOT NULL,
    "type" "GeneratedDocumentType" NOT NULL,
    "status" "GeneratedDocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "templateCode" TEXT,
    "fileUrl" TEXT,
    "payload" JSONB,
    "errorMessage" TEXT,
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "tripId" TEXT NOT NULL,

    CONSTRAINT "TripGeneratedDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DangerousProduct_companyId_idx" ON "DangerousProduct"("companyId");

-- CreateIndex
CREATE INDEX "DangerousProduct_unNumber_idx" ON "DangerousProduct"("unNumber");

-- CreateIndex
CREATE INDEX "DangerousProduct_active_idx" ON "DangerousProduct"("active");

-- CreateIndex
CREATE INDEX "TripProduct_tripId_idx" ON "TripProduct"("tripId");

-- CreateIndex
CREATE INDEX "TripProduct_dangerousProductId_idx" ON "TripProduct"("dangerousProductId");

-- CreateIndex
CREATE INDEX "TripProduct_invoiceKey_idx" ON "TripProduct"("invoiceKey");

-- CreateIndex
CREATE INDEX "TripComplianceCheck_tripId_idx" ON "TripComplianceCheck"("tripId");

-- CreateIndex
CREATE INDEX "TripComplianceCheck_status_idx" ON "TripComplianceCheck"("status");

-- CreateIndex
CREATE INDEX "TripComplianceCheck_checkedAt_idx" ON "TripComplianceCheck"("checkedAt");

-- CreateIndex
CREATE INDEX "TripComplianceCheck_checkedByUserId_idx" ON "TripComplianceCheck"("checkedByUserId");

-- CreateIndex
CREATE INDEX "TripComplianceResult_checkId_idx" ON "TripComplianceResult"("checkId");

-- CreateIndex
CREATE INDEX "TripComplianceResult_ruleCode_idx" ON "TripComplianceResult"("ruleCode");

-- CreateIndex
CREATE INDEX "TripComplianceResult_severity_idx" ON "TripComplianceResult"("severity");

-- CreateIndex
CREATE INDEX "TripComplianceResult_passed_idx" ON "TripComplianceResult"("passed");

-- CreateIndex
CREATE INDEX "TripGeneratedDocument_tripId_idx" ON "TripGeneratedDocument"("tripId");

-- CreateIndex
CREATE INDEX "TripGeneratedDocument_type_idx" ON "TripGeneratedDocument"("type");

-- CreateIndex
CREATE INDEX "TripGeneratedDocument_status_idx" ON "TripGeneratedDocument"("status");

-- CreateIndex
CREATE INDEX "TripUsage_companyId_idx" ON "TripUsage"("companyId");

-- CreateIndex
CREATE INDEX "TripUsage_branchId_idx" ON "TripUsage"("branchId");

-- CreateIndex
CREATE INDEX "TripUsage_status_idx" ON "TripUsage"("status");

-- AddForeignKey
ALTER TABLE "TripUsage" ADD CONSTRAINT "TripUsage_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUsage" ADD CONSTRAINT "TripUsage_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DangerousProduct" ADD CONSTRAINT "DangerousProduct_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripProduct" ADD CONSTRAINT "TripProduct_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripUsage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripProduct" ADD CONSTRAINT "TripProduct_dangerousProductId_fkey" FOREIGN KEY ("dangerousProductId") REFERENCES "DangerousProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripComplianceCheck" ADD CONSTRAINT "TripComplianceCheck_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripUsage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripComplianceCheck" ADD CONSTRAINT "TripComplianceCheck_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripComplianceResult" ADD CONSTRAINT "TripComplianceResult_checkId_fkey" FOREIGN KEY ("checkId") REFERENCES "TripComplianceCheck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripGeneratedDocument" ADD CONSTRAINT "TripGeneratedDocument_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripUsage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
