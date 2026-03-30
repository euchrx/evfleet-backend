-- CreateEnum
CREATE TYPE "public"."XmlProcessingType" AS ENUM ('FUEL', 'PRODUCT', 'SERVICE', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "public"."XmlProcessingStatus" AS ENUM ('PENDING', 'SUGGESTED', 'PROCESSED', 'IGNORED', 'ERROR');

-- AlterTable
ALTER TABLE "public"."XmlInvoice"
ADD COLUMN "processingType" "public"."XmlProcessingType" NOT NULL DEFAULT 'UNKNOWN',
ADD COLUMN "processingStatus" "public"."XmlProcessingStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "processedAt" TIMESTAMP(3);
