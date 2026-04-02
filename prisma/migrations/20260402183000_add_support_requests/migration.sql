DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportRequestCategory') THEN
    CREATE TYPE "SupportRequestCategory" AS ENUM ('BUG', 'IMPROVEMENT', 'REQUEST');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SupportRequestStatus') THEN
    CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'IN_PROGRESS', 'COMPLETED');
  END IF;
END $$;

CREATE TABLE "SupportRequest" (
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
  CONSTRAINT "SupportRequest_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE CASCADE
ON UPDATE CASCADE;

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_respondedByUserId_fkey"
FOREIGN KEY ("respondedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "SupportRequest_companyId_idx" ON "SupportRequest"("companyId");
CREATE INDEX "SupportRequest_status_idx" ON "SupportRequest"("status");
CREATE INDEX "SupportRequest_createdAt_idx" ON "SupportRequest"("createdAt");
