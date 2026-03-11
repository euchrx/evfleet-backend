CREATE TABLE "MaintenancePlan" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "planType" TEXT NOT NULL,
  "intervalUnit" TEXT NOT NULL,
  "intervalValue" INTEGER NOT NULL,
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

CREATE INDEX "MaintenancePlan_vehicleId_idx" ON "MaintenancePlan"("vehicleId");
CREATE INDEX "MaintenancePlan_nextDueDate_idx" ON "MaintenancePlan"("nextDueDate");

ALTER TABLE "MaintenancePlan"
ADD CONSTRAINT "MaintenancePlan_vehicleId_fkey"
FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
