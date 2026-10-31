import { Request, Response, NextFunction } from "express";
import { AppError } from "@/middlewares/errorHandler";
import {
  createPostSchema,
  updatePostSchema,
  updatePostStatusSchema,
  listPostsQuerySchema,
  managePostsQuerySchema,
  searchPostsQuerySchema,
} from "@/schemas/postSchema";
import {
  createPost,
  updatePost,
  updatePostStatus,
  softDeletePost,
  listPosts,
  listMyPosts,
  listAllPostsForAdmin,
  listPostsByAuthor,
  searchPosts,
  getPostBySlug,
  getPostById,
} from "@/services/postService";
import { getClientIp } from "@/lib/ip";
import { uploadImageBuffer } from "@/services/uploadService";

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: any } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error?.issues?.[0]?.message ?? "입력값이 올바르지 않습니다.";
    throw new AppError(message, 400);
  }
  return parsed.data as T;
}

/** Express 5의 req.params 값은 string | string[] 타입이라, 단일 문자열임을 보장해 반환한다. */
function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = parseOrThrow(createPostSchema, req.body);
    const post = await createPost(req.user!.id, input);
    res.status(201).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = parseOrThrow(updatePostSchema, req.body);
    const post = await updatePost(paramId(req.params.id), input);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function updateStatus(req: Request, res: Response, next: NextFunction) {
  try {
    const input = parseOrThrow(updatePostStatusSchema, req.body);
    const post = await updatePostStatus(paramId(req.params.id), input.status);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await softDeletePost(paramId(req.params.id));
    res.status(200).json({ success: true, message: "게시글이 삭제되었습니다." });
  } catch (err) {
    next(err);
  }
}

export async function list(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseOrThrow(listPostsQuerySchema, req.query);
    const result = await listPosts(query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

export async function detail(req: Request, res: Response, next: NextFunction) {
  try {
    const ip = getClientIp(req);
    const post = await getPostBySlug(paramId(req.params.slug), ip);
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

/** GET /api/posts/:id/edit — 수정 화면 진입용 (DRAFT 포함, 조회수 증가 없음, 소유권 검증 후에만 도달) */
export async function detailById(req: Request, res: Response, next: NextFunction) {
  try {
    const post = await getPostById(paramId(req.params.id));
    res.status(200).json({ success: true, data: post });
  } catch (err) {
    next(err);
  }
}

/** GET /api/search?q= — 🔓 제목+본문 검색 (공개 글만, 검색어 주변 미리보기 포함) */
export async function search(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseOrThrow(searchPostsQuerySchema, req.query);
    const result = await searchPosts(query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** GET /api/users/me/posts — 마이페이지 (본인 글, DRAFT 포함, q/status 필터) */
export async function myPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseOrThrow(managePostsQuerySchema, req.query);
    const result = await listMyPosts(req.user!.id, query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** GET /api/users/:id/posts — 특정 작성자의 공개 글 목록 */
export async function postsByAuthor(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseOrThrow(listPostsQuerySchema, req.query);
    const result = await listPostsByAuthor(paramId(req.params.id), query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** GET /api/admin/posts — 전체 게시글 (모더레이션용, DRAFT 포함, 삭제된 글 제외, q=제목/작성자명 검색) */
export async function adminListAllPosts(req: Request, res: Response, next: NextFunction) {
  try {
    const query = parseOrThrow(managePostsQuerySchema, req.query);
    const result = await listAllPostsForAdmin(query);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

/** POST /api/posts/upload-image — 에디터 이미지 업로드 (로그인 유저 누구나, Cloudinary) */
export async function uploadPostImage(req: Request, res: Response, next: NextFunction) {
  try {
    if (!req.file) {
      throw new AppError("업로드할 이미지 파일이 없습니다.", 400);
    }
    const url = await uploadImageBuffer(req.file.buffer);
    res.status(201).json({ success: true, data: { url } });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/posts/:id — 관리자 강제 삭제 (소유권 무관) */
export async function adminForceDeletePost(req: Request, res: Response, next: NextFunction) {
  try {
    await softDeletePost(paramId(req.params.id));
    res.status(200).json({ success: true, message: "관리자 권한으로 게시글이 삭제되었습니다." });
  } catch (err) {
    next(err);
  }
}
