/*
  Warnings:

  - You are about to drop the column `costCenterId` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `currentKm` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Vehicle` table. All the data in the column will be lost.
  - You are about to drop the `CostCenter` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "Vehicle" DROP CONSTRAINT "Vehicle_costCenterId_fkey";

-- AlterTable
ALTER TABLE "Vehicle" DROP COLUMN "costCenterId",
DROP COLUMN "currentKm",
DROP COLUMN "status";

-- DropTable
DROP TABLE "CostCenter";
