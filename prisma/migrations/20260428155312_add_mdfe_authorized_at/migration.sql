-- AlterTable
ALTER TABLE "Mdfe" ADD COLUMN     "authorizedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Mdfe_accessKey_idx" ON "Mdfe"("accessKey");

-- CreateIndex
CREATE INDEX "Mdfe_protocol_idx" ON "Mdfe"("protocol");
