-- CreateEnum
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'MODEL', 'TOOL');

-- Safely convert existing role TEXT column to the new enum using USING cast.
-- Existing values 'user', 'model', 'tool' are uppercased to match the enum.
ALTER TABLE "ai_chat_messages"
  ALTER COLUMN "role" TYPE "AiMessageRole"
  USING (upper("role")::"AiMessageRole");

-- AlterTable: add toolOutput and toolError columns
ALTER TABLE "ai_chat_messages"
  ADD COLUMN "toolOutput" JSONB,
  ADD COLUMN "toolError"  TEXT;

-- AlterTable: add modelName and totalTokens to sessions
ALTER TABLE "ai_chat_sessions"
  ADD COLUMN "modelName"   TEXT    NOT NULL DEFAULT 'gemini-2.5-flash',
  ADD COLUMN "totalTokens" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex: tool usage analytics
CREATE INDEX "ai_chat_messages_toolName_idx" ON "ai_chat_messages"("toolName");
