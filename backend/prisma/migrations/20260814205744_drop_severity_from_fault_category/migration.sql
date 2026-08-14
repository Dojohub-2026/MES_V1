/*
  Warnings:

  - You are about to drop the column `severity` on the `blueprint_fault_categories` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "blueprint_fault_categories" DROP COLUMN "severity";
