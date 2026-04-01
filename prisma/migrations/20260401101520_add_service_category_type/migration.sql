-- CreateEnum
CREATE TYPE "ServiceCategoryType" AS ENUM ('EXAMINATION', 'LAB');

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "type" "ServiceCategoryType" NOT NULL DEFAULT 'LAB';
