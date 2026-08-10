import type { AuthUser } from "@/types/auth";

declare module "next-auth" {
  interface User extends AuthUser {
    /** authorize()가 반환하는 값에 백엔드 accessToken/refreshToken도 함께 실어보낸다. */
    accessToken?: string;
    refreshToken?: string;
  }

  interface Session {
    user: AuthUser;
    accessToken: string;
    error?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    accessTokenExpires?: number;
    user?: AuthUser;
    error?: string;
  }
}
