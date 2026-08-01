-- CreateEnum
CREATE TYPE "BotGameResult" AS ENUM ('WIN', 'LOSS', 'DRAW', 'ABANDONED');

-- CreateTable
CREATE TABLE "BotLevel" (
    "id" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "elo" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBotProgress" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botLevelId" TEXT NOT NULL,
    "isUnlocked" BOOLEAN NOT NULL DEFAULT false,
    "wins" INTEGER NOT NULL DEFAULT 0,
    "losses" INTEGER NOT NULL DEFAULT 0,
    "draws" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBotProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotGameHistory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "botLevelId" TEXT NOT NULL,
    "result" "BotGameResult" NOT NULL,
    "pgn" TEXT,
    "fen" TEXT,
    "moveCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotGameHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotLevel_level_key" ON "BotLevel"("level");

-- CreateIndex
CREATE INDEX "UserBotProgress_userId_idx" ON "UserBotProgress"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBotProgress_userId_botLevelId_key" ON "UserBotProgress"("userId", "botLevelId");

-- CreateIndex
CREATE INDEX "BotGameHistory_userId_idx" ON "BotGameHistory"("userId");

-- CreateIndex
CREATE INDEX "BotGameHistory_botLevelId_idx" ON "BotGameHistory"("botLevelId");

-- AddForeignKey
ALTER TABLE "UserBotProgress" ADD CONSTRAINT "UserBotProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBotProgress" ADD CONSTRAINT "UserBotProgress_botLevelId_fkey" FOREIGN KEY ("botLevelId") REFERENCES "BotLevel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGameHistory" ADD CONSTRAINT "BotGameHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotGameHistory" ADD CONSTRAINT "BotGameHistory_botLevelId_fkey" FOREIGN KEY ("botLevelId") REFERENCES "BotLevel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
