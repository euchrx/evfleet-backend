-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VehicleType" AS ENUM ('LIGHT', 'HEAVY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VehicleCategory" AS ENUM ('CAR', 'TRUCK', 'UTILITY', 'IMPLEMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'ETHANOL', 'DIESEL', 'ARLA32', 'FLEX', 'ELECTRIC', 'HYBRID', 'CNG');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'SOLD');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "Role" AS ENUM ('ADMIN', 'FLEET_MANAGER', 'REGIONAL_MANAGER', 'BRANCH_MANAGER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DebtCategory" AS ENUM ('FINE', 'IPVA', 'LICENSING', 'INSURANCE', 'TOLL', 'TAX', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "VehicleImplementHistoryEventType" AS ENUM ('LINKED', 'UNLINKED', 'POSITION_CHANGED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TireMovementType" AS ENUM ('MOVE', 'ROTATION');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "TireStatus" AS ENUM ('IN_STOCK', 'INSTALLED', 'MAINTENANCE', 'RETREADED', 'SCRAPPED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DocumentType" AS ENUM ('LICENSING', 'INSURANCE', 'IPVA', 'LEASING_CONTRACT', 'INSPECTION', 'CNH', 'EAR', 'MOPP', 'TOXICOLOGICAL_EXAM', 'EMPLOYMENT_RECORD', 'RG', 'CPF_DOCUMENT', 'DEFENSIVE_DRIVING', 'TRUCAO_TRANSPORTE', 'CRLV', 'CIV', 'CIPP', 'ENVIRONMENTAL_AUTHORIZATION', 'RNTRC', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "DocumentOwnerType" AS ENUM ('VEHICLE', 'DRIVER', 'GENERAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM ('DRAFT', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED', 'CANCELED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BillingGateway" AS ENUM ('MANUAL', 'INFINITEPAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "WebhookProcessStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SupportRequestCategory" AS ENUM ('BUG', 'IMPROVEMENT', 'REQUEST');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "XmlImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "XmlInvoiceStatus" AS ENUM ('AUTHORIZED', 'CANCELED', 'DENIED', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "XmlProcessingType" AS ENUM ('FUEL', 'PRODUCT', 'SERVICE', 'RETAIL_PRODUCT', 'UNKNOWN');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "XmlProcessingStatus" AS ENUM ('PENDING', 'SUGGESTED', 'PROCESSED', 'IGNORED', 'ERROR');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "AxleConfiguration" AS ENUM ('SINGLE', 'DUAL');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;