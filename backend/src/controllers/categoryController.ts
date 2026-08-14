import { Request, Response, NextFunction } from "express";
import { AppError } from "@/middlewares/errorHandler";
import { createCategorySchema, updateCategorySchema } from "@/schemas/categorySchema";
import { listCategories, createCategory, updateCategory, deleteCategory, listTags } from "@/services/categoryService";

function parseOrThrow<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T; error?: any } }, value: unknown): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    const message = parsed.error?.issues?.[0]?.message ?? "입력값이 올바르지 않습니다.";
    throw new AppError(message, 400);
  }
  return parsed.data as T;
}

function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

/** GET /api/categories — 공개 */
export async function list(_req: Request, res: Response, next: NextFunction) {
  try {
    const categories = await listCategories();
    res.status(200).json({ success: true, data: categories });
  } catch (err) {
    next(err);
  }
}

/** POST /api/admin/categories — 🛡️ 관리자 전용 */
export async function create(req: Request, res: Response, next: NextFunction) {
  try {
    const input = parseOrThrow(createCategorySchema, req.body);
    const category = await createCategory(input);
    res.status(201).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

/** PATCH /api/admin/categories/:id — 🛡️ 관리자 전용 */
export async function update(req: Request, res: Response, next: NextFunction) {
  try {
    const input = parseOrThrow(updateCategorySchema, req.body);
    const category = await updateCategory(paramId(req.params.id), input);
    res.status(200).json({ success: true, data: category });
  } catch (err) {
    next(err);
  }
}

/** DELETE /api/admin/categories/:id — 🛡️ 관리자 전용 */
export async function remove(req: Request, res: Response, next: NextFunction) {
  try {
    await deleteCategory(paramId(req.params.id));
    res.status(200).json({ success: true, message: "카테고리가 삭제되었습니다." });
  } catch (err) {
    next(err);
  }
}

/** GET /api/tags — 공개 */
export async function listTagsHandler(_req: Request, res: Response, next: NextFunction) {
  try {
    const tags = await listTags();
    res.status(200).json({ success: true, data: tags });
  } catch (err) {
    next(err);
  }
}
