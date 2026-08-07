import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middlewares/errorHandler";
import { signAccessToken, signRefreshToken } from "@/lib/jwt";
import { logger } from "@/lib/logger";
import type { SignupInput, LoginInput } from "@/schemas/authSchema";

const BCRYPT_SALT_ROUNDS = 12;

export async function signupUser(input: SignupInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });

  if (existing) {
    // 409: 이미 사용 중인 이메일
    throw new AppError("이미 사용 중인 이메일입니다.", 409);
  }

  const hashedPassword = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.create({
    data: {
      email: input.email,
      password: hashedPassword,
      name: input.name,
      // role, status는 스키마 기본값(USER, ACTIVE) 사용 — 클라이언트가 임의로 지정 불가
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  logger.info(`회원가입 성공: ${user.email} (${user.id})`);

  return user;
}

export async function loginUser(input: LoginInput) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });

  // 🔐 이메일 열거(enumeration) 공격 방지:
  // "이메일이 없음"과 "비밀번호가 틀림"을 구분하지 않고 동일한 메시지/타이밍으로 응답한다.
  const genericInvalidCredentials = () => {
    logger.warn(`로그인 실패: ${input.email}`);
    throw new AppError("이메일 또는 비밀번호가 올바르지 않습니다.", 401);
  };

  if (!user || !user.password) {
    // bcrypt.compare와 유사한 지연시간을 만들어 타이밍 공격 완화
    await bcrypt.compare(input.password, "$2b$12$invalidsaltinvalidsaltinvalidsalte");
    genericInvalidCredentials();
    return;
  }

  if (user.status === "SUSPENDED") {
    logger.warn(`정지된 계정 로그인 시도: ${user.email} (${user.id})`);
    throw new AppError(
      "이용이 정지된 계정입니다. 문의사항은 관리자에게 연락해주세요.",
      403,
    );
  }

  const isPasswordValid = await bcrypt.compare(input.password, user.password);

  if (!isPasswordValid) {
    genericInvalidCredentials();
    return;
  }

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  const refreshToken = signRefreshToken({ sub: user.id });

  logger.info(`로그인 성공: ${user.email} (${user.id})`);

  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
  };
}
