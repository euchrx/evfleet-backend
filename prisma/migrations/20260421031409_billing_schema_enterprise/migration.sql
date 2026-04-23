-- CreateEnum
CREATE TYPE IF NOT EXISTS "VehicleType" AS ENUM ('LIGHT', 'HEAVY');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "VehicleCategory" AS ENUM ('CAR', 'TRUCK', 'UTILITY', 'IMPLEMENT');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "FuelType" AS ENUM ('GASOLINE', 'ETHANOL', 'DIESEL', 'ARLA32', 'FLEX', 'ELECTRIC', 'HYBRID', 'CNG');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'SOLD');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "Role" AS ENUM ('ADMIN', 'FLEET_MANAGER', 'REGIONAL_MANAGER', 'BRANCH_MANAGER');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "DebtCategory" AS ENUM ('FINE', 'IPVA', 'LICENSING', 'INSURANCE', 'TOLL', 'TAX', 'OTHER');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "VehicleImplementHistoryEventType" AS ENUM ('LINKED', 'UNLINKED', 'POSITION_CHANGED');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "TireMovementType" AS ENUM ('MOVE', 'ROTATION');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "TireStatus" AS ENUM ('IN_STOCK', 'INSTALLED', 'MAINTENANCE', 'RETREADED', 'SCRAPPED');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "DocumentType" AS ENUM ('LICENSING', 'INSURANCE', 'IPVA', 'LEASING_CONTRACT', 'INSPECTION', 'CNH', 'EAR', 'MOPP', 'TOXICOLOGICAL_EXAM', 'EMPLOYMENT_RECORD', 'RG', 'CPF_DOCUMENT', 'DEFENSIVE_DRIVING', 'TRUCAO_TRANSPORTE', 'CRLV', 'CIV', 'CIPP', 'ENVIRONMENTAL_AUTHORIZATION', 'RNTRC', 'OTHER');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "DocumentOwnerType" AS ENUM ('VEHICLE', 'DRIVER', 'GENERAL');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "PlanInterval" AS ENUM ('MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "SubscriptionStatus" AS ENUM ('DRAFT', 'TRIALING', 'ACTIVE', 'PAST_DUE', 'CANCELED');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'EXPIRED', 'FAILED', 'REFUNDED', 'CANCELED');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "BillingGateway" AS ENUM ('MANUAL', 'INFINITEPAY');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "WebhookProcessStatus" AS ENUM ('PENDING', 'PROCESSED', 'FAILED');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "SupportRequestCategory" AS ENUM ('BUG', 'IMPROVEMENT', 'REQUEST');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "XmlImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "XmlInvoiceStatus" AS ENUM ('AUTHORIZED', 'CANCELED', 'DENIED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "XmlProcessingType" AS ENUM ('FUEL', 'PRODUCT', 'SERVICE', 'RETAIL_PRODUCT', 'UNKNOWN');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "XmlProcessingStatus" AS ENUM ('PENDING', 'SUGGESTED', 'PROCESSED', 'IGNORED', 'ERROR');

-- CreateEnum
CREATE TYPE IF NOT EXISTS "AxleConfiguration" AS ENUM ('SINGLE', 'DUAL');

-- CreateTable
CREATE TABLE IF NOT EXISTS "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "slug" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "legalAcceptanceVersion" TEXT,
    "legalAcceptedAt" TIMESTAMP(3),
    "legalAcceptedByUserId" TEXT,
    "legalAcceptedByUserName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Branch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Vehicle" (
    "id" TEXT NOT NULL,
    "plate" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "vehicleType" "VehicleType" NOT NULL DEFAULT 'LIGHT',
    "axleCount" INTEGER,
    "axleConfiguration" "AxleConfiguration",
    "category" "VehicleCategory" NOT NULL DEFAULT 'CAR',
    "chassis" TEXT,
    "renavam" TEXT,
    "acquisitionDate" TIMESTAMP(3),
    "fuelType" "FuelType",
    "tankCapacity" DOUBLE PRECISION,
    "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
    "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "currentKm" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "costCenterId" TEXT,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleProfilePhoto" (
    "id" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT NOT NULL,

    CONSTRAINT "VehicleProfilePhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CostCenter" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "CostCenter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'BRANCH_MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Driver" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cpf" TEXT NOT NULL,
    "cnh" TEXT NOT NULL,
    "cnhCategory" TEXT NOT NULL,
    "cnhExpiresAt" TIMESTAMP(3) NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "partsReplaced" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "workshop" TEXT,
    "responsible" TEXT,
    "cost" DOUBLE PRECISION NOT NULL,
    "km" INTEGER NOT NULL,
    "maintenanceDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "MaintenancePlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "planType" TEXT NOT NULL,
    "intervalUnit" TEXT NOT NULL,
    "intervalValue" INTEGER NOT NULL,
    "alertBeforeKm" INTEGER DEFAULT 500,
    "alertBeforeDays" INTEGER DEFAULT 7,
    "nextDueDate" TIMESTAMP(3),
    "nextDueKm" INTEGER,
    "lastExecutedDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT NOT NULL,

    CONSTRAINT "MaintenancePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Debt" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "DebtCategory" NOT NULL DEFAULT 'FINE',
    "amount" DOUBLE PRECISION NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "debtDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3),
    "referenceMonth" TEXT,
    "creditor" TEXT,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT,

    CONSTRAINT "Debt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "FuelRecord" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT,
    "liters" DOUBLE PRECISION NOT NULL,
    "totalValue" DOUBLE PRECISION NOT NULL,
    "km" INTEGER NOT NULL,
    "station" TEXT NOT NULL,
    "fuelType" "FuelType" NOT NULL,
    "averageConsumptionKmPerLiter" DOUBLE PRECISION,
    "isAnomaly" BOOLEAN NOT NULL DEFAULT false,
    "anomalyReason" TEXT,
    "fuelDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sourceInvoiceKey" TEXT,
    "sourceInvoiceLineIndex" INTEGER,
    "sourceProductCode" TEXT,
    "sourcePlate" TEXT,
    "sourceFuelDateTime" TIMESTAMP(3),
    "sourceItems" JSONB,
    "vehicleId" TEXT,
    "driverId" TEXT,

    CONSTRAINT "FuelRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleChangeLog" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT NOT NULL,

    CONSTRAINT "VehicleChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleImplementHistory" (
    "id" TEXT NOT NULL,
    "eventType" "VehicleImplementHistoryEventType" NOT NULL,
    "position" INTEGER,
    "oldPosition" INTEGER,
    "newPosition" INTEGER,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT NOT NULL,
    "implementId" TEXT NOT NULL,
    "actorUserId" TEXT,

    CONSTRAINT "VehicleImplementHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT,
    "oldData" JSONB,
    "newData" JSONB,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorUserId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TripUsage" (
    "id" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "reason" TEXT,
    "kmStart" INTEGER NOT NULL,
    "kmEnd" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,

    CONSTRAINT "TripUsage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleDocument" (
    "id" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "ownerType" "DocumentOwnerType" NOT NULL DEFAULT 'VEHICLE',
    "title" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "provider" TEXT,
    "notes" TEXT,
    "fileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,

    CONSTRAINT "VehicleDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "VehicleImplementLink" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "implementId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VehicleImplementLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Tire" (
    "id" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "rim" INTEGER,
    "purchaseDate" TIMESTAMP(3),
    "purchaseCost" DOUBLE PRECISION,
    "status" "TireStatus" NOT NULL DEFAULT 'IN_STOCK',
    "axlePosition" TEXT,
    "wheelPosition" TEXT,
    "currentKm" INTEGER NOT NULL DEFAULT 0,
    "currentTreadDepthMm" DOUBLE PRECISION,
    "currentPressurePsi" DOUBLE PRECISION,
    "targetPressurePsi" DOUBLE PRECISION,
    "minTreadDepthMm" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "installedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "vehicleId" TEXT,

    CONSTRAINT "Tire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TireReading" (
    "id" TEXT NOT NULL,
    "readingDate" TIMESTAMP(3) NOT NULL,
    "km" INTEGER NOT NULL,
    "treadDepthMm" DOUBLE PRECISION NOT NULL,
    "pressurePsi" DOUBLE PRECISION NOT NULL,
    "condition" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "tireId" TEXT NOT NULL,
    "vehicleId" TEXT,

    CONSTRAINT "TireReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "TireMovement" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "tireId" TEXT,
    "secondTireId" TEXT,
    "type" "TireMovementType" NOT NULL,
    "tireSerial" TEXT NOT NULL,
    "secondTireSerial" TEXT,
    "fromAxle" TEXT,
    "fromWheel" TEXT,
    "toAxle" TEXT,
    "toWheel" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TireMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Plan" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL,
    "vehicleLimit" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "interval" "PlanInterval" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "isEnterprise" BOOLEAN NOT NULL DEFAULT false,
    "defaultTrialDays" INTEGER,
    "defaultGraceDays" INTEGER DEFAULT 5,
    "allowsCustomPrice" BOOLEAN NOT NULL DEFAULT false,
    "allowsCustomVehicleLimit" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" TEXT NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'DRAFT',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "nextBillingAt" TIMESTAMP(3),
    "trialEndsAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "trialDays" INTEGER,
    "graceDays" INTEGER DEFAULT 5,
    "customPriceCents" INTEGER,
    "customVehicleLimit" INTEGER,
    "planNameSnapshot" TEXT,
    "planCodeSnapshot" TEXT,
    "priceCentsSnapshot" INTEGER,
    "vehicleLimitSnapshot" INTEGER,
    "currencySnapshot" TEXT,
    "intervalSnapshot" "PlanInterval",
    "graceEndsAt" TIMESTAMP(3),
    "accessBlockedAt" TIMESTAMP(3),
    "isCustomConfiguration" BOOLEAN NOT NULL DEFAULT false,
    "externalCustomerId" TEXT,
    "externalSubscriptionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "Payment" (
    "id" TEXT NOT NULL,
    "gateway" "BillingGateway" NOT NULL DEFAULT 'MANUAL',
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "gatewayReference" TEXT,
    "checkoutUrl" TEXT,
    "externalPaymentId" TEXT,
    "invoiceUrl" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "WebhookEvent" (
    "id" TEXT NOT NULL,
    "gateway" "BillingGateway" NOT NULL DEFAULT 'MANUAL',
    "eventType" TEXT NOT NULL,
    "externalEventId" TEXT,
    "payload" JSONB NOT NULL,
    "processStatus" "WebhookProcessStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "companyId" TEXT,
    "subscriptionId" TEXT,

    CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "XmlImportBatch" (
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
CREATE TABLE IF NOT EXISTS "XmlInvoice" (
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
    "processingType" "XmlProcessingType" NOT NULL DEFAULT 'UNKNOWN',
    "processingStatus" "XmlProcessingStatus" NOT NULL DEFAULT 'PENDING',
    "processedAt" TIMESTAMP(3),
    "linkedFuelRecordId" TEXT,
    "linkedMaintenanceRecordId" TEXT,
    "linkedCostId" TEXT,
    "linkedRetailProductImportId" TEXT,
    "rawXml" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "batchId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,

    CONSTRAINT "XmlInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "XmlInvoiceItem" (
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

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetailProductImport" (
    "id" TEXT NOT NULL,
    "supplierName" TEXT,
    "supplierDocument" TEXT,
    "invoiceNumber" TEXT,
    "invoiceSeries" TEXT,
    "issuedAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(14,2),
    "sourceInvoiceKey" TEXT,
    "sourcePlate" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "branchId" TEXT,
    "vehicleId" TEXT,
    "xmlInvoiceId" TEXT,

    CONSTRAINT "RetailProductImport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "RetailProductImportItem" (
    "id" TEXT NOT NULL,
    "productCode" TEXT,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "quantity" DECIMAL(14,4),
    "unitValue" DECIMAL(14,4),
    "totalValue" DECIMAL(14,2),
    "sourceInvoiceKey" TEXT,
    "sourceInvoiceLineIndex" INTEGER,
    "sourceProductCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retailProductImportId" TEXT NOT NULL,

    CONSTRAINT "RetailProductImportItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "SupportRequest" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "SupportRequestCategory" NOT NULL DEFAULT 'REQUEST',
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "responseMessage" TEXT,
    "estimatedCompletionAt" TIMESTAMP(3),
    "respondedAt" TIMESTAMP(3),
    "completionMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "respondedByUserId" TEXT,
    "completedByUserId" TEXT,

    CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Company_slug_key" ON "Company"("slug");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Company_active_idx" ON "Company"("active");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Branch_companyId_idx" ON "Branch"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_plate_key" ON "Vehicle"("plate");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_chassis_key" ON "Vehicle"("chassis");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Vehicle_renavam_key" ON "Vehicle"("renavam");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Vehicle_companyId_idx" ON "Vehicle"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Vehicle_branchId_idx" ON "Vehicle"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleProfilePhoto_vehicleId_key" ON "VehicleProfilePhoto"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleProfilePhoto_vehicleId_idx" ON "VehicleProfilePhoto"("vehicleId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_companyId_idx" ON "User"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Driver_cpf_key" ON "Driver"("cpf");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Driver_cnh_key" ON "Driver"("cnh");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenanceRecord_vehicleId_idx" ON "MaintenanceRecord"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenancePlan_vehicleId_idx" ON "MaintenancePlan"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenancePlan_nextDueDate_idx" ON "MaintenancePlan"("nextDueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Debt_vehicleId_idx" ON "Debt"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FuelRecord_vehicleId_idx" ON "FuelRecord"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FuelRecord_driverId_idx" ON "FuelRecord"("driverId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FuelRecord_isAnomaly_idx" ON "FuelRecord"("isAnomaly");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FuelRecord_invoiceNumber_idx" ON "FuelRecord"("invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FuelRecord_sourceInvoiceKey_sourceInvoiceLineIndex_idx" ON "FuelRecord"("sourceInvoiceKey", "sourceInvoiceLineIndex");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "FuelRecord_sourceInvoiceKey_sourcePlate_fuelType_idx" ON "FuelRecord"("sourceInvoiceKey", "sourcePlate", "fuelType");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "FuelRecord_sourceInvoiceKey_sourcePlate_fuelType_key" ON "FuelRecord"("sourceInvoiceKey", "sourcePlate", "fuelType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleChangeLog_vehicleId_idx" ON "VehicleChangeLog"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleChangeLog_changedAt_idx" ON "VehicleChangeLog"("changedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleImplementHistory_vehicleId_changedAt_idx" ON "VehicleImplementHistory"("vehicleId", "changedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleImplementHistory_implementId_changedAt_idx" ON "VehicleImplementHistory"("implementId", "changedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleImplementHistory_actorUserId_idx" ON "VehicleImplementHistory"("actorUserId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TripUsage_vehicleId_idx" ON "TripUsage"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TripUsage_driverId_idx" ON "TripUsage"("driverId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TripUsage_startedAt_idx" ON "TripUsage"("startedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleDocument_companyId_idx" ON "VehicleDocument"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleDocument_vehicleId_idx" ON "VehicleDocument"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleDocument_driverId_idx" ON "VehicleDocument"("driverId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleDocument_ownerType_idx" ON "VehicleDocument"("ownerType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleDocument_expiryDate_idx" ON "VehicleDocument"("expiryDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleImplementLink_vehicleId_idx" ON "VehicleImplementLink"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "VehicleImplementLink_implementId_idx" ON "VehicleImplementLink"("implementId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleImplementLink_vehicleId_implementId_key" ON "VehicleImplementLink"("vehicleId", "implementId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "VehicleImplementLink_vehicleId_position_key" ON "VehicleImplementLink"("vehicleId", "position");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Tire_serialNumber_key" ON "Tire"("serialNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tire_vehicleId_idx" ON "Tire"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tire_status_idx" ON "Tire"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TireReading_tireId_idx" ON "TireReading"("tireId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TireReading_vehicleId_idx" ON "TireReading"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TireReading_readingDate_idx" ON "TireReading"("readingDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TireMovement_companyId_vehicleId_createdAt_idx" ON "TireMovement"("companyId", "vehicleId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TireMovement_companyId_tireId_createdAt_idx" ON "TireMovement"("companyId", "tireId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Plan_code_key" ON "Plan"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Plan_isActive_idx" ON "Plan"("isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Plan_isPublic_idx" ON "Plan"("isPublic");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Plan_isEnterprise_idx" ON "Plan"("isEnterprise");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Plan_sortOrder_idx" ON "Plan"("sortOrder");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_companyId_idx" ON "Subscription"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_planId_idx" ON "Subscription"("planId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_graceEndsAt_idx" ON "Subscription"("graceEndsAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Subscription_accessBlockedAt_idx" ON "Subscription"("accessBlockedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_companyId_idx" ON "Payment"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_subscriptionId_idx" ON "Payment"("subscriptionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_status_idx" ON "Payment"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_dueDate_idx" ON "Payment"("dueDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_gatewayReference_idx" ON "Payment"("gatewayReference");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookEvent_externalEventId_key" ON "WebhookEvent"("externalEventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEvent_companyId_idx" ON "WebhookEvent"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEvent_subscriptionId_idx" ON "WebhookEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookEvent_processStatus_idx" ON "WebhookEvent"("processStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlImportBatch_companyId_idx" ON "XmlImportBatch"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlImportBatch_branchId_idx" ON "XmlImportBatch"("branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlImportBatch_status_idx" ON "XmlImportBatch"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlImportBatch_createdAt_idx" ON "XmlImportBatch"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "XmlInvoice_invoiceKey_key" ON "XmlInvoice"("invoiceKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_batchId_idx" ON "XmlInvoice"("batchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_companyId_idx" ON "XmlInvoice"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_branchId_idx" ON "XmlInvoice"("branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_issuedAt_idx" ON "XmlInvoice"("issuedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_linkedFuelRecordId_idx" ON "XmlInvoice"("linkedFuelRecordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_linkedMaintenanceRecordId_idx" ON "XmlInvoice"("linkedMaintenanceRecordId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_linkedCostId_idx" ON "XmlInvoice"("linkedCostId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoice_linkedRetailProductImportId_idx" ON "XmlInvoice"("linkedRetailProductImportId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "XmlInvoiceItem_invoiceId_idx" ON "XmlInvoiceItem"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailProductImport_companyId_idx" ON "RetailProductImport"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailProductImport_branchId_idx" ON "RetailProductImport"("branchId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailProductImport_vehicleId_idx" ON "RetailProductImport"("vehicleId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailProductImport_issuedAt_idx" ON "RetailProductImport"("issuedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailProductImport_sourceInvoiceKey_idx" ON "RetailProductImport"("sourceInvoiceKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailProductImport_sourcePlate_idx" ON "RetailProductImport"("sourcePlate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailProductImportItem_retailProductImportId_idx" ON "RetailProductImportItem"("retailProductImportId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RetailProductImportItem_sourceInvoiceKey_sourceInvoiceLineI_idx" ON "RetailProductImportItem"("sourceInvoiceKey", "sourceInvoiceLineIndex");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RetailProductImportItem_sourceInvoiceKey_sourceInvoiceLineI_key" ON "RetailProductImportItem"("sourceInvoiceKey", "sourceInvoiceLineIndex", "sourceProductCode");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SupportRequest_companyId_idx" ON "SupportRequest"("companyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SupportRequest_status_idx" ON "SupportRequest"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SupportRequest_createdAt_idx" ON "SupportRequest"("createdAt");

-- AddForeignKey
ALTER TABLE "Branch" ADD CONSTRAINT "Branch_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_costCenterId_fkey" FOREIGN KEY ("costCenterId") REFERENCES "CostCenter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleProfilePhoto" ADD CONSTRAINT "VehicleProfilePhoto_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenancePlan" ADD CONSTRAINT "MaintenancePlan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Debt" ADD CONSTRAINT "Debt_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRecord" ADD CONSTRAINT "FuelRecord_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FuelRecord" ADD CONSTRAINT "FuelRecord_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleChangeLog" ADD CONSTRAINT "VehicleChangeLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImplementHistory" ADD CONSTRAINT "VehicleImplementHistory_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImplementHistory" ADD CONSTRAINT "VehicleImplementHistory_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImplementHistory" ADD CONSTRAINT "VehicleImplementHistory_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUsage" ADD CONSTRAINT "TripUsage_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripUsage" ADD CONSTRAINT "TripUsage_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImplementLink" ADD CONSTRAINT "VehicleImplementLink_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleImplementLink" ADD CONSTRAINT "VehicleImplementLink_implementId_fkey" FOREIGN KEY ("implementId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tire" ADD CONSTRAINT "Tire_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireReading" ADD CONSTRAINT "TireReading_tireId_fkey" FOREIGN KEY ("tireId") REFERENCES "Tire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireReading" ADD CONSTRAINT "TireReading_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireMovement" ADD CONSTRAINT "TireMovement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireMovement" ADD CONSTRAINT "TireMovement_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireMovement" ADD CONSTRAINT "TireMovement_tireId_fkey" FOREIGN KEY ("tireId") REFERENCES "Tire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TireMovement" ADD CONSTRAINT "TireMovement_secondTireId_fkey" FOREIGN KEY ("secondTireId") REFERENCES "Tire"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WebhookEvent" ADD CONSTRAINT "WebhookEvent_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "RetailProductImport" ADD CONSTRAINT "RetailProductImport_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailProductImport" ADD CONSTRAINT "RetailProductImport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailProductImport" ADD CONSTRAINT "RetailProductImport_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailProductImport" ADD CONSTRAINT "RetailProductImport_xmlInvoiceId_fkey" FOREIGN KEY ("xmlInvoiceId") REFERENCES "XmlInvoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RetailProductImportItem" ADD CONSTRAINT "RetailProductImportItem_retailProductImportId_fkey" FOREIGN KEY ("retailProductImportId") REFERENCES "RetailProductImport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_respondedByUserId_fkey" FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupportRequest" ADD CONSTRAINT "SupportRequest_completedByUserId_fkey" FOREIGN KEY ("completedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
