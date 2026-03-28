ALTER TABLE "Subscription" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "companyId" TEXT;
ALTER TABLE "WebhookEvent" ADD COLUMN "companyId" TEXT;

UPDATE "Subscription" s
SET "companyId" = b."companyId"
FROM "Branch" b
WHERE s."branchId" = b."id"
  AND s."companyId" IS NULL;

UPDATE "Payment" p
SET "companyId" = s."companyId"
FROM "Subscription" s
WHERE p."subscriptionId" = s."id"
  AND p."companyId" IS NULL;

UPDATE "Payment" p
SET "companyId" = b."companyId"
FROM "Branch" b
WHERE p."branchId" = b."id"
  AND p."companyId" IS NULL;

UPDATE "WebhookEvent" w
SET "companyId" = s."companyId"
FROM "Subscription" s
WHERE w."subscriptionId" = s."id"
  AND w."companyId" IS NULL;

UPDATE "WebhookEvent" w
SET "companyId" = b."companyId"
FROM "Branch" b
WHERE w."branchId" = b."id"
  AND w."companyId" IS NULL;

ALTER TABLE "Subscription"
ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "Payment"
ALTER COLUMN "companyId" SET NOT NULL;

CREATE INDEX "Subscription_companyId_idx" ON "Subscription"("companyId");
CREATE INDEX "Payment_companyId_idx" ON "Payment"("companyId");
CREATE INDEX "WebhookEvent_companyId_idx" ON "WebhookEvent"("companyId");

ALTER TABLE "Subscription"
ADD CONSTRAINT "Subscription_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Payment"
ADD CONSTRAINT "Payment_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WebhookEvent"
ADD CONSTRAINT "WebhookEvent_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Subscription" DROP CONSTRAINT IF EXISTS "Subscription_branchId_fkey";
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_branchId_fkey";
ALTER TABLE "WebhookEvent" DROP CONSTRAINT IF EXISTS "WebhookEvent_branchId_fkey";

DROP INDEX IF EXISTS "Subscription_branchId_idx";
DROP INDEX IF EXISTS "Payment_branchId_idx";
DROP INDEX IF EXISTS "WebhookEvent_branchId_idx";

ALTER TABLE "Subscription" DROP COLUMN IF EXISTS "branchId";
ALTER TABLE "Payment" DROP COLUMN IF EXISTS "branchId";
ALTER TABLE "WebhookEvent" DROP COLUMN IF EXISTS "branchId";

