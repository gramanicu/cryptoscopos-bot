/*
  Warnings:

  - Added the required column `ending` to the `competitions` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "competitions" ADD COLUMN     "ending" TIMESTAMP(3) NOT NULL;
