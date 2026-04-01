ALTER TABLE "Vehicle"
ADD COLUMN "companyId" TEXT;

UPDATE "Vehicle" v
SET "companyId" = b."companyId"
FROM "Branch" b
WHERE v."branchId" = b."id"
  AND v."companyId" IS NULL;

ALTER TABLE "Vehicle"
ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "Vehicle"
ALTER COLUMN "branchId" DROP NOT NULL;

ALTER TABLE "Vehicle"
ADD CONSTRAINT "Vehicle_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "Vehicle_companyId_idx" ON "Vehicle"("companyId");
