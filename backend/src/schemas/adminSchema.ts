import { z } from "zod";

/** GET /api/admin/users 쿼리 (q = 닉네임/이메일 검색) */
export const adminUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  q: z.string().trim().optional(),
  status: z.enum(["ACTIVE", "SUSPENDED"]).optional(),
});

export type AdminUsersQuery = z.infer<typeof adminUsersQuerySchema>;

/** PATCH /api/admin/users/:id/status — role 변경은 이 API로 할 수 없다 (스키마에 role 없음) */
export const updateUserStatusSchema = z.object({
  status: z.enum(["ACTIVE", "SUSPENDED"]),
});
