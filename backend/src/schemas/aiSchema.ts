import { z } from "zod";

/** POST /api/admin/ai/draft — 아이디어(필수) + 1·2단계 문서 등 참고 자료(선택) */
export const blogDraftRequestSchema = z.object({
  idea: z
    .string({ error: "글감(아이디어)을 입력해주세요." })
    .trim()
    .min(5, "글감은 5자 이상 입력해주세요.")
    .max(2000, "글감은 2000자 이내로 입력해주세요."),
  // 요구조건/기술 명세서, 개발 로그 등 — 토큰 비용 상한을 위해 길이를 제한한다
  sourceDocument: z
    .string()
    .max(60000, "참고 자료는 60,000자 이내로 붙여넣어 주세요.")
    .optional(),
});
