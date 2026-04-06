ALTER TABLE "Company"
ADD COLUMN "legalAcceptanceVersion" TEXT,
ADD COLUMN "legalAcceptedAt" TIMESTAMP(3),
ADD COLUMN "legalAcceptedByUserId" TEXT,
ADD COLUMN "legalAcceptedByUserName" TEXT;
