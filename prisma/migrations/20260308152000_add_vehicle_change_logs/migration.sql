-- CreateTable
CREATE TABLE "VehicleChangeLog" (
    "id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleId" TEXT NOT NULL,

    CONSTRAINT "VehicleChangeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VehicleChangeLog_vehicleId_idx" ON "VehicleChangeLog"("vehicleId");

-- CreateIndex
CREATE INDEX "VehicleChangeLog_changedAt_idx" ON "VehicleChangeLog"("changedAt");

-- AddForeignKey
ALTER TABLE "VehicleChangeLog" ADD CONSTRAINT "VehicleChangeLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
