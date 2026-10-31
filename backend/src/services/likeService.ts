import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middlewares/errorHandler";

/** 좋아요를 누른 "사람"을 식별하는 값 — 로그인 유저는 계정, 비로그인은 guestId 쿠키 */
export type LikeIdentity = { userId: string } | { guestId: string };

export interface LikeStatus {
  liked: boolean;
  likeCount: number;
}

/** 좋아요를 누를 수 있는(=공개된) 게시글인지 확인 */
async function assertLikeablePost(postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!post) throw new AppError("게시글을 찾을 수 없습니다.", 404);
}

function whereFor(postId: string, identity: LikeIdentity): Prisma.PostLikeWhereInput {
  return "userId" in identity
    ? { postId, userId: identity.userId }
    : { postId, guestId: identity.guestId, userId: null };
}

async function countLikes(postId: string) {
  return prisma.postLike.count({ where: { postId } });
}

/** GET /api/posts/:postId/like — identity가 없으면(쿠키 없는 첫 방문 게스트) liked=false */
export async function getLikeStatus(postId: string, identity: LikeIdentity | null): Promise<LikeStatus> {
  await assertLikeablePost(postId);

  const [mine, likeCount] = await Promise.all([
    identity ? prisma.postLike.findFirst({ where: whereFor(postId, identity), select: { id: true } }) : null,
    countLikes(postId),
  ]);

  return { liked: Boolean(mine), likeCount };
}

/** POST /api/posts/:postId/like — 눌려 있으면 취소, 아니면 추가 */
export async function toggleLike(postId: string, identity: LikeIdentity): Promise<LikeStatus> {
  await assertLikeablePost(postId);

  const existing = await prisma.postLike.findFirst({
    where: whereFor(postId, identity),
    select: { id: true },
  });

  if (existing) {
    await prisma.postLike.delete({ where: { id: existing.id } });
    return { liked: false, likeCount: await countLikes(postId) };
  }

  try {
    await prisma.postLike.create({ data: { postId, ...identity } });
  } catch (err) {
    // 같은 사람이 거의 동시에 두 번 누른 경우 — unique 제약(postId+userId / postId+guestId)이
    // 두 번째 생성을 막는다. 이미 눌린 상태이므로 에러 대신 "좋아요 상태"로 응답한다.
    if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")) throw err;
  }

  return { liked: true, likeCount: await countLikes(postId) };
}
