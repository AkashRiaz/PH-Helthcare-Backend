/*
  Warnings:

  - You are about to drop the column `resume` on the `doctors` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "doctors" DROP COLUMN "resume",
ADD COLUMN     "resumeUrl" TEXT;
