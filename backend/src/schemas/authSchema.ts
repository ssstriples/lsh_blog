import { z } from "zod";

/**
 * 회원가입 입력 검증
 * - 이메일: 표준 이메일 형식
 * - 비밀번호: 최소 8자, 영문+숫자+특수문자 최소 1개씩 (강도 확보)
 * - 닉네임: 2~20자
 */
export const signupSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다."),
  password: z
    .string()
    .min(8, "비밀번호는 최소 8자 이상이어야 합니다.")
    .regex(/[a-zA-Z]/, "비밀번호에 영문자를 포함해야 합니다.")
    .regex(/[0-9]/, "비밀번호에 숫자를 포함해야 합니다.")
    .regex(/[^a-zA-Z0-9]/, "비밀번호에 특수문자를 포함해야 합니다."),
  name: z
    .string()
    .trim()
    .min(2, "닉네임은 최소 2자 이상이어야 합니다.")
    .max(20, "닉네임은 최대 20자까지 가능합니다."),
});

export type SignupInput = z.infer<typeof signupSchema>;

/**
 * 로그인 입력 검증
 * - 회원가입보다 느슨하게 검증 (기존 계정의 비밀번호 규칙 변경 이력과 무관하게 로그인 자체는 허용)
 */
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("올바른 이메일 형식이 아닙니다."),
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export type LoginInput = z.infer<typeof loginSchema>;
