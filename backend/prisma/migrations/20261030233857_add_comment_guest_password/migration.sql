-- AlterTable
ALTER TABLE "comments" ADD COLUMN     "guestPasswordHash" TEXT;

-- CreateIndex
CREATE INDEX "comments_createdAt_idx" ON "comments"("createdAt");
