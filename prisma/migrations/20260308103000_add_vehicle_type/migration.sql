CREATE TYPE "VehicleType" AS ENUM ('LIGHT', 'HEAVY');

ALTER TABLE "Vehicle"
ADD COLUMN "vehicleType" "VehicleType" NOT NULL DEFAULT 'LIGHT';
