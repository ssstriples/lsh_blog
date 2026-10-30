import bcrypt from "bcryptjs";
import DOMPurify from "isomorphic-dompurify";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middlewares/errorHandler";
import type { AuthUser } from "@/middlewares/authMiddleware";
import type { AdminCommentsQuery, CreateCommentInput } from "@/schemas/commentSchema";

/** 게스트 비밀번호는 "삭제 확인용 간단 비밀번호"라 로그인 비밀번호(12)보다 가볍게 해싱한다. */
const GUEST_PASSWORD_SALT_ROUNDS = 10;

/**
 * 게스트 댓글의 "소유자 ID" 자리에 들어가는 값.
 * requireOwnership은 null을 "리소스 없음(404)"으로 취급하므로, 게스트 댓글은 어떤 유저 id와도
 * 일치하지 않는 값을 돌려줘 일반 유저는 403, ADMIN은 예외 통과(모더레이션)하도록 만든다.
 */
const GUEST_OWNER_ID = "__guest__";

const COMMENT_SELECT = {
  id: true,
  parentId: true,
  content: true,
  guestName: true,
  createdAt: true,
  deletedAt: true,
  user: { select: { id: true, name: true } },
} satisfies Prisma.CommentSelect;

type CommentRow = Prisma.CommentGetPayload<{ select: typeof COMMENT_SELECT }>;

export type CommentAuthor = { type: "user"; id: string; name: string } | { type: "guest"; name: string };

export interface CommentNode {
  id: string;
  parentId: string | null;
  content: string;
  createdAt: Date;
  isDeleted: boolean;
  /** 삭제된 댓글은 작성자도 숨긴다 */
  author: CommentAuthor | null;
  replies: CommentNode[];
}

/**
 * 댓글은 평문(plain text)으로만 저장한다 — 모든 태그를 제거하고 텍스트만 남긴다.
 * `sanitize()`의 문자열 결과는 `<`를 `&lt;`로 바꿔버려 "a < b" 같은 일반 문장이 깨지므로,
 * DOM으로 받아 textContent(디코딩된 순수 텍스트)를 꺼낸다.
 */
function sanitizeCommentContent(text: string): string {
  const fragment = DOMPurify.sanitize(text, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
    RETURN_DOM_FRAGMENT: true,
  });
  return (fragment.textContent ?? "").trim();
}

function toNode(row: CommentRow): CommentNode {
  const isDeleted = row.deletedAt !== null;
  const author: CommentAuthor | null = isDeleted
    ? null
    : row.user
      ? { type: "user", id: row.user.id, name: row.user.name }
      : { type: "guest", name: row.guestName ?? "익명" };

  return {
    id: row.id,
    parentId: row.parentId,
    content: isDeleted ? "" : row.content,
    createdAt: row.createdAt,
    isDeleted,
    author,
    replies: [],
  };
}

/** 삭제된 댓글 중 살아있는 답글이 없는 것은 트리에서 제거한다 (답글이 있으면 "삭제된 댓글입니다"로 자리만 유지). */
function pruneDeleted(nodes: CommentNode[]): CommentNode[] {
  return nodes
    .map((node) => ({ ...node, replies: pruneDeleted(node.replies) }))
    .filter((node) => !node.isDeleted || node.replies.length > 0);
}

/** 댓글을 달 수 있는(=공개된) 게시글인지 확인 */
async function assertCommentablePost(postId: string) {
  const post = await prisma.post.findFirst({
    where: { id: postId, deletedAt: null, status: "PUBLISHED" },
    select: { id: true },
  });
  if (!post) throw new AppError("게시글을 찾을 수 없습니다.", 404);
}

/** GET /api/posts/:postId/comments — parentId 관계를 트리로 조립해 반환한다. */
export async function listComments(postId: string) {
  await assertCommentablePost(postId);

  // 삭제된 댓글도 함께 가져온다 — 답글이 달린 삭제 댓글은 트리 구조 유지를 위해 자리가 필요하다.
  const rows = await prisma.comment.findMany({
    where: { postId },
    orderBy: { createdAt: "asc" },
    select: COMMENT_SELECT,
  });

  const nodes = new Map(rows.map((row) => [row.id, toNode(row)]));
  const roots: CommentNode[] = [];

  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    if (parent) parent.replies.push(node);
    else roots.push(node);
  }

  return {
    comments: pruneDeleted(roots),
    totalCount: rows.filter((row) => row.deletedAt === null).length,
  };
}

/** POST /api/posts/:postId/comments — 로그인 유저 또는 게스트(닉네임+비밀번호) */
export async function createComment(postId: string, input: CreateCommentInput, user?: AuthUser) {
  await assertCommentablePost(postId);

  const content = sanitizeCommentContent(input.content);
  if (!content) throw new AppError("댓글 내용을 입력해주세요.", 400);

  if (input.parentId) {
    const parent = await prisma.comment.findFirst({
      where: { id: input.parentId, postId, deletedAt: null },
      select: { id: true },
    });
    if (!parent) throw new AppError("답글을 달 댓글을 찾을 수 없습니다.", 400);
  }

  const base = { postId, content, parentId: input.parentId ?? null };

  if (user) {
    // Access Token(15분)이 살아있는 동안 정지/탈퇴된 계정도 막기 위해 DB에서 현재 상태를 다시 확인한다.
    const author = await prisma.user.findUnique({
      where: { id: user.id },
      select: { status: true, deletedAt: true },
    });
    if (!author || author.deletedAt) throw new AppError("로그인이 필요합니다.", 401);
    if (author.status === "SUSPENDED") {
      throw new AppError("정지된 계정은 댓글을 작성할 수 없습니다.", 403);
    }

    const row = await prisma.comment.create({
      data: { ...base, userId: user.id }, // ⚠️ 요청 바디가 아닌 인증된 사용자 ID로 서버에서 강제 설정
      select: COMMENT_SELECT,
    });
    return toNode(row);
  }

  const guestName = input.guestName ? sanitizeCommentContent(input.guestName) : "";
  if (!guestName || !input.guestPassword) {
    throw new AppError("비로그인 댓글은 닉네임과 비밀번호가 필요합니다.", 400);
  }

  const row = await prisma.comment.create({
    data: {
      ...base,
      guestName,
      guestPasswordHash: await bcrypt.hash(input.guestPassword, GUEST_PASSWORD_SALT_ROUNDS),
    },
    select: COMMENT_SELECT,
  });
  return toNode(row);
}

/** 소유권 검증용 — 회원 댓글은 userId, 게스트 댓글은 GUEST_OWNER_ID, 없으면 null(404) */
export async function getCommentOwnerId(commentId: string): Promise<string | null> {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
    select: { userId: true },
  });
  if (!comment) return null;
  return comment.userId ?? GUEST_OWNER_ID;
}

/** 소프트 삭제 — 답글이 있으면 목록에서 "삭제된 댓글입니다"로 표시된다. */
export async function softDeleteComment(commentId: string) {
  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
}

/** POST /api/comments/:id/guest-delete — 게스트 댓글을 작성 시 비밀번호로 삭제 */
export async function deleteGuestComment(commentId: string, password: string) {
  const comment = await prisma.comment.findFirst({
    where: { id: commentId, deletedAt: null },
    select: { guestPasswordHash: true },
  });
  if (!comment) throw new AppError("댓글을 찾을 수 없습니다.", 404);
  if (!comment.guestPasswordHash) {
    throw new AppError("회원 댓글은 로그인 후 삭제할 수 있습니다.", 403);
  }

  const isMatch = await bcrypt.compare(password, comment.guestPasswordHash);
  if (!isMatch) throw new AppError("비밀번호가 일치하지 않습니다.", 403);

  await softDeleteComment(commentId);
}

/** GET /api/admin/comments — 전체 댓글 (모더레이션용, 삭제된 댓글 제외, 최신순) */
export async function listAllCommentsForAdmin(query: AdminCommentsQuery) {
  const { page, limit, q } = query;

  const where: Prisma.CommentWhereInput = {
    deletedAt: null,
    ...(q
      ? {
          OR: [
            { content: { contains: q, mode: "insensitive" } },
            { guestName: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [comments, totalCount] = await Promise.all([
    prisma.comment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        content: true,
        guestName: true,
        createdAt: true,
        parentId: true,
        user: { select: { id: true, name: true, email: true } },
        post: { select: { id: true, title: true, slug: true } },
      },
    }),
    prisma.comment.count({ where }),
  ]);

  return {
    comments,
    pagination: { page, limit, totalCount, totalPages: Math.ceil(totalCount / limit) },
  };
}
