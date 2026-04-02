-- AlterTable
ALTER TABLE "SupportRequest"
ADD COLUMN "completedByUserId" TEXT;

-- CreateIndex
CREATE INDEX "SupportRequest_completedByUserId_idx" ON "SupportRequest"("completedByUserId");

-- AddForeignKey
ALTER TABLE "SupportRequest"
ADD CONSTRAINT "SupportRequest_completedByUserId_fkey"
FOREIGN KEY ("completedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
