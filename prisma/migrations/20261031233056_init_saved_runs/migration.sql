-- CreateEnum
CREATE TYPE "ThreatLabel" AS ENUM ('low', 'medium', 'high', 'unknown');

-- CreateEnum
CREATE TYPE "AiMode" AS ENUM ('mock', 'live');

-- CreateTable
CREATE TABLE "saved_runs" (
    "id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "threat_label" "ThreatLabel" NOT NULL,
    "mode" "AiMode" NOT NULL,
    "input_tokens" INTEGER NOT NULL,
    "output_tokens" INTEGER NOT NULL,
    "cost_usd" DECIMAL(12,8) NOT NULL,
    "excerpt_length" INTEGER NOT NULL,
    "excerpt_sha256" CHAR(64) NOT NULL,

    CONSTRAINT "saved_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "saved_runs_created_at_idx" ON "saved_runs"("created_at");

-- CreateIndex
CREATE INDEX "saved_runs_excerpt_sha256_created_at_idx" ON "saved_runs"("excerpt_sha256", "created_at");
