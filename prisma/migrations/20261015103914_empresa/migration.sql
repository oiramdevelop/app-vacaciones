-- CreateEnum
CREATE TYPE "Company" AS ENUM ('FLORAMARKET', 'GALACTICBLUM');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "company" "Company" NOT NULL DEFAULT 'FLORAMARKET';

-- CreateIndex
CREATE INDEX "User_company_idx" ON "User"("company");
