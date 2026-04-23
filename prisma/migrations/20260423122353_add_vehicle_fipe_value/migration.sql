-- DropForeignKey
ALTER TABLE "Subscription" DROP CONSTRAINT "Subscription_companyId_fkey";

-- AlterTable
ALTER TABLE "Vehicle" ADD COLUMN     "fipeValue" DECIMAL(12,2);

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
