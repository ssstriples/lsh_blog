import { Request, Response, NextFunction } from "express";
import { AppError } from "@/middlewares/errorHandler";
import { AI_MODEL, isAiEnabled } from "@/lib/anthropic";
import { blogDraftRequestSchema } from "@/schemas/aiSchema";
import { generateBlogDraft } from "@/services/aiService";

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: any } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error?.issues?.[0]?.message ?? "입력값이 올바르지 않습니다.";
    throw new AppError(message, 400);
  }
  return parsed.data as T;
}

/** GET /api/admin/ai/status — 🛡️ AI 기능 사용 가능 여부 (에디터 버튼 활성화용, 키 값은 노출하지 않음) */
export function status(_req: Request, res: Response) {
  res.status(200).json({ success: true, data: { enabled: isAiEnabled(), model: AI_MODEL } });
}

/** POST /api/admin/ai/draft — 🛡️ 글감(+ 참고 문서) → 블로그 초안 (저장하지 않고 에디터에 넣을 결과만 반환) */
export async function draft(req: Request, res: Response, next: NextFunction) {
  try {
    const { idea, sourceDocument } = parseOrThrow(blogDraftRequestSchema, req.body);
    const result = await generateBlogDraft(idea, sourceDocument);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}
