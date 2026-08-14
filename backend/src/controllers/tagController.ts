import { Request, Response, NextFunction } from "express";
import { listTags } from "@/services/tagService";

/** GET /api/tags — 공개, 태그 생성은 게시글 저장 시 자동 upsert */
export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await listTags();
    res.status(200).json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
}
