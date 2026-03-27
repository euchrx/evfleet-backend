CREATE TABLE "VehicleProfilePhoto" (
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

CREATE UNIQUE INDEX "VehicleProfilePhoto_vehicleId_key" ON "VehicleProfilePhoto"("vehicleId");
CREATE INDEX "VehicleProfilePhoto_vehicleId_idx" ON "VehicleProfilePhoto"("vehicleId");

ALTER TABLE "VehicleProfilePhoto"
ADD CONSTRAINT "VehicleProfilePhoto_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
