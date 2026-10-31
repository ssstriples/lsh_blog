-- CreateIndex
CREATE UNIQUE INDEX "post_likes_postId_guestId_key" ON "post_likes"("postId", "guestId");

-- CreateIndex
CREATE INDEX "post_views_viewedAt_idx" ON "post_views"("viewedAt");

