-- CreateEnum
CREATE TYPE "MdfeEventType" AS ENUM ('CLOSE', 'CANCEL', 'CONSULT');

-- CreateEnum
CREATE TYPE "MdfeEventStatus" AS ENUM ('SENT', 'AUTHORIZED', 'REJECTED', 'ERROR');

-- AlterTable
ALTER TABLE "Mdfe" ADD COLUMN     "lastEventAt" TIMESTAMP(3),
ADD COLUMN     "lastEventCode" TEXT,
ADD COLUMN     "lastEventReason" TEXT;

-- CreateTable
CREATE TABLE "MdfeEvent" (
    "id" TEXT NOT NULL,
    "mdfeId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "type" "MdfeEventType" NOT NULL,
    "status" "MdfeEventStatus" NOT NULL DEFAULT 'SENT',
    "eventSequence" INTEGER,
    "eventProtocol" TEXT,
    "eventCode" TEXT,
    "eventReason" TEXT,
    "eventAt" TIMESTAMP(3),
    "requestXml" TEXT,
    "responseXml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MdfeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MdfeEvent_mdfeId_idx" ON "MdfeEvent"("mdfeId");

-- CreateIndex
CREATE INDEX "MdfeEvent_companyId_idx" ON "MdfeEvent"("companyId");

-- CreateIndex
CREATE INDEX "MdfeEvent_type_idx" ON "MdfeEvent"("type");

-- CreateIndex
CREATE INDEX "MdfeEvent_status_idx" ON "MdfeEvent"("status");

-- CreateIndex
CREATE INDEX "MdfeEvent_eventProtocol_idx" ON "MdfeEvent"("eventProtocol");

-- CreateIndex
CREATE INDEX "MdfeEvent_createdAt_idx" ON "MdfeEvent"("createdAt");

-- CreateIndex
CREATE INDEX "Mdfe_companyId_status_idx" ON "Mdfe"("companyId", "status");

-- AddForeignKey
ALTER TABLE "MdfeEvent" ADD CONSTRAINT "MdfeEvent_mdfeId_fkey" FOREIGN KEY ("mdfeId") REFERENCES "Mdfe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MdfeEvent" ADD CONSTRAINT "MdfeEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
