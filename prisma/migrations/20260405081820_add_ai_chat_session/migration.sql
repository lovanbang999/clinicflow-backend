-- CreateEnum
CREATE TYPE "AiSessionOutcome" AS ENUM ('ONGOING', 'BOOKING_MADE', 'ABANDONED', 'REPORTED');

-- CreateTable
CREATE TABLE "ai_chat_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientProfileId" TEXT,
    "outcome" "AiSessionOutcome" NOT NULL DEFAULT 'ONGOING',
    "bookingId" TEXT,
    "feedbackRating" INTEGER,
    "feedbackNote" TEXT,
    "reportedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_chat_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_chat_messages" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "toolName" TEXT,
    "toolInput" JSONB,
    "tokenCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_chat_sessions_userId_startedAt_idx" ON "ai_chat_sessions"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "ai_chat_sessions_outcome_idx" ON "ai_chat_sessions"("outcome");

-- CreateIndex
CREATE INDEX "ai_chat_sessions_startedAt_idx" ON "ai_chat_sessions"("startedAt");

-- CreateIndex
CREATE INDEX "ai_chat_messages_sessionId_createdAt_idx" ON "ai_chat_messages"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_sessions" ADD CONSTRAINT "ai_chat_sessions_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_chat_messages" ADD CONSTRAINT "ai_chat_messages_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ai_chat_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
