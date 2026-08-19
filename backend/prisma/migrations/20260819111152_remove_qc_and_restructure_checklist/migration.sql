-- DropForeignKey
ALTER TABLE "blueprint_qc_questions" DROP CONSTRAINT "blueprint_qc_questions_blueprintId_fkey";

-- DropForeignKey
ALTER TABLE "qc_responses" DROP CONSTRAINT "qc_responses_questionId_fkey";

-- DropForeignKey
ALTER TABLE "qc_responses" DROP CONSTRAINT "qc_responses_stageId_fkey";

-- AlterTable
ALTER TABLE "batch_entries" ADD COLUMN     "checklistData" JSONB;

-- AlterTable
ALTER TABLE "blueprints" DROP COLUMN "checklistValidationTiming",
DROP COLUMN "qcFormEnabled";

-- AlterTable
ALTER TABLE "job_stages" DROP COLUMN "requiresQc";

-- DropTable
DROP TABLE "blueprint_qc_questions";

-- DropTable
DROP TABLE "qc_responses";
