import { z } from "zod";

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "카테고리 이름을 입력해주세요.").max(50, "카테고리 이름은 50자 이내여야 합니다."),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/, "슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.")
    .optional(),
  sortOrder: z.coerce.number().int().optional().default(0),
});
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = createCategorySchema.partial();
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
