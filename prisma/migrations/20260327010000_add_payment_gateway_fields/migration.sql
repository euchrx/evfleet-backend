-- AlterTable
ALTER TABLE "Payment"
ADD COLUMN "gatewayReference" TEXT,
ADD COLUMN "checkoutUrl" TEXT;

-- CreateIndex
CREATE INDEX "Payment_gatewayReference_idx" ON "Payment"("gatewayReference");
