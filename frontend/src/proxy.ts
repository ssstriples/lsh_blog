import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

/**
 * `/my/*`, `/posts/new`, `/posts/:id/edit` — 로그인 필요 (비로그인 → /login 리다이렉트)
 * `/admin/*` — 관리자 전용 (비관리자 → 403 페이지)
 * (수정 페이지의 "본인 글인지" 검증은 페이지 서버 컴포넌트에서 백엔드 응답(403)으로 처리)
 */
export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  const isWritePage = pathname === "/posts/new" || /^\/posts\/[^/]+\/edit$/.test(pathname);

  if (pathname.startsWith("/my") || isWritePage) {
    if (!session?.user) {
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname.startsWith("/admin")) {
    if (!session?.user) {
      const loginUrl = new URL("/login", req.nextUrl.origin);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
    if (session.user.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/403", req.nextUrl.origin));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/my/:path*", "/admin/:path*", "/posts/new", "/posts/:id/edit"],
};
