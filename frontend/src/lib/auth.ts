import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { API_BASE_URL } from "@/lib/api";
import type { AuthUser, LoginResponseData, RefreshResponseData } from "@/types/auth";

/** Access Token 만료 15분 — 백엔드(backend/src/lib/jwt.ts)의 만료시간과 반드시 동일해야 한다. */
const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;

async function refreshAccessToken(refreshToken: string): Promise<{ accessToken: string } | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
      method: "POST",
      // ⚠️ 서버 사이드(Node.js) fetch만 가능한 방식: 브라우저 fetch는 Cookie 헤더를 직접
      // 설정할 수 없지만, Next.js 서버(이 파일)에서 실행되는 fetch는 가능하다.
      // NextAuth JWT에 안전하게 보관해둔 refreshToken 값을 쿠키 형태로 재구성해 보낸다.
      headers: { Cookie: `refreshToken=${refreshToken}` },
    });

    const body = await res.json();
    if (!res.ok || !body?.success) return null;

    return { accessToken: (body.data as RefreshResponseData).accessToken };
  } catch {
    return null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const body = await res.json().catch(() => null);

        if (!res.ok || !body?.success) {
          // NextAuth는 authorize()가 null을 반환하면 "CredentialsSignin" 에러로 처리한다.
          // 백엔드가 준 구체적인 메시지(계정 정지, 비밀번호 오류 등)를 그대로 전달하기 위해
          // Error를 throw하면 클라이언트의 signIn() 결과에서 error 메시지로 확인할 수 있다.
          throw new Error(body?.message ?? "로그인에 실패했습니다.");
        }

        const data = body.data as LoginResponseData;

        // authorize()의 반환값이 그대로 jwt() 콜백의 `user` 인자로 전달된다.
        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.name,
          role: data.user.role,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      // 최초 로그인 시점 — authorize()가 반환한 값을 토큰에 저장
      if (user) {
        const u = user as unknown as AuthUser & { accessToken: string; refreshToken: string };
        token.accessToken = u.accessToken;
        token.refreshToken = u.refreshToken;
        token.accessTokenExpires = Date.now() + ACCESS_TOKEN_TTL_MS;
        token.user = { id: u.id, email: u.email, name: u.name, role: u.role };
        return token;
      }

      // Access Token이 아직 유효하면 그대로 반환
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }

      // 만료되었으면 Refresh Token으로 재발급 시도
      const refreshed = await refreshAccessToken(token.refreshToken as string);
      if (!refreshed) {
        // 재발급 실패 — 세션을 무효화하기 위해 에러 표시를 남긴다 (session에서 감지해 로그아웃 처리)
        return { ...token, error: "RefreshAccessTokenError" as const };
      }

      return {
        ...token,
        accessToken: refreshed.accessToken,
        accessTokenExpires: Date.now() + ACCESS_TOKEN_TTL_MS,
      };
    },
    async session({ session, token }) {
      return {
        ...session,
        user: token.user as AuthUser,
        accessToken: token.accessToken as string,
        error: token.error as string | undefined,
      };
    },
  },
});
