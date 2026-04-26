-- CreateEnum
CREATE TYPE "FiscalEnvironment" AS ENUM ('HOMOLOGATION', 'PRODUCTION');

-- CreateTable
CREATE TABLE "CompanyFiscalSettings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "corporateName" TEXT NOT NULL,
    "tradeName" TEXT,
    "stateRegistration" TEXT,
    "taxRegime" TEXT,
    "addressStreet" TEXT NOT NULL,
    "addressNumber" TEXT NOT NULL,
    "addressDistrict" TEXT NOT NULL,
    "addressComplement" TEXT,
    "cityName" TEXT NOT NULL,
    "cityIbgeCode" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "mdfeEnvironment" "FiscalEnvironment" NOT NULL DEFAULT 'HOMOLOGATION',
    "mdfeSeries" INTEGER NOT NULL DEFAULT 1,
    "mdfeNextNumber" INTEGER NOT NULL DEFAULT 1,
    "certificatePfxUrl" TEXT,
    "certificatePasswordEncrypted" TEXT,
    "certificateExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyFiscalSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyFiscalSettings_companyId_key" ON "CompanyFiscalSettings"("companyId");

-- CreateIndex
CREATE INDEX "CompanyFiscalSettings_cnpj_idx" ON "CompanyFiscalSettings"("cnpj");

-- AddForeignKey
ALTER TABLE "CompanyFiscalSettings" ADD CONSTRAINT "CompanyFiscalSettings_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
