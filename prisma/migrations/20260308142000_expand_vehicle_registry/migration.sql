-- CreateEnum
CREATE TYPE "VehicleCategory" AS ENUM ('CAR', 'TRUCK', 'UTILITY');

-- CreateEnum
CREATE TYPE "FuelType" AS ENUM ('GASOLINE', 'ETHANOL', 'DIESEL', 'FLEX', 'ELECTRIC', 'HYBRID', 'CNG');

-- CreateEnum
CREATE TYPE "VehicleStatus" AS ENUM ('ACTIVE', 'MAINTENANCE', 'SOLD');

-- AlterTable
ALTER TABLE "Vehicle"
ADD COLUMN "category" "VehicleCategory" NOT NULL DEFAULT 'CAR',
ADD COLUMN "chassis" TEXT,
ADD COLUMN "renavam" TEXT,
ADD COLUMN "acquisitionDate" TIMESTAMP(3),
ADD COLUMN "fuelType" "FuelType",
ADD COLUMN "tankCapacity" DOUBLE PRECISION,
ADD COLUMN "status" "VehicleStatus" NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN "photoUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "documentUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_chassis_key" ON "Vehicle"("chassis");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_renavam_key" ON "Vehicle"("renavam");
