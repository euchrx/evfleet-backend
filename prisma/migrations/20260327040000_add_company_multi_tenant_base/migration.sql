CREATE TABLE "Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "document" TEXT,
    "slug" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Company_slug_key" ON "Company"("slug");
CREATE INDEX "Company_active_idx" ON "Company"("active");

ALTER TABLE "Branch" ADD COLUMN "companyId" TEXT;
ALTER TABLE "User" ADD COLUMN "companyId" TEXT;

INSERT INTO "Company" ("id", "name", "slug", "active", "createdAt", "updatedAt")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Empresa Padrão',
  'empresa-padrao',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
)
ON CONFLICT ("id") DO NOTHING;

UPDATE "Branch"
SET "companyId" = '00000000-0000-0000-0000-000000000001'
WHERE "companyId" IS NULL;

UPDATE "User"
SET "companyId" = '00000000-0000-0000-0000-000000000001'
WHERE "companyId" IS NULL;

ALTER TABLE "Branch"
ALTER COLUMN "companyId" SET NOT NULL;

ALTER TABLE "User"
ALTER COLUMN "companyId" SET NOT NULL;

CREATE INDEX "Branch_companyId_idx" ON "Branch"("companyId");
CREATE INDEX "User_companyId_idx" ON "User"("companyId");

ALTER TABLE "Branch"
ADD CONSTRAINT "Branch_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "User"
ADD CONSTRAINT "User_companyId_fkey"
FOREIGN KEY ("companyId") REFERENCES "Company"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

