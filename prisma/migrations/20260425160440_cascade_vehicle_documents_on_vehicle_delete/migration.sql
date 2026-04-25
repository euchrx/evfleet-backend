-- DropForeignKey
ALTER TABLE "VehicleDocument" DROP CONSTRAINT "VehicleDocument_vehicleId_fkey";

-- AddForeignKey
ALTER TABLE "VehicleDocument" ADD CONSTRAINT "VehicleDocument_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
