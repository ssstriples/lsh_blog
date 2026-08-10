"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { PenSquare, User as UserIcon, LogOut, LayoutDashboard } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function Header() {
  const { data: session, status } = useSession();
  const isLoading = status === "loading";
  const user = session?.user;

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-semibold tracking-tight">
          lsh_blog
        </Link>

        <nav className="flex items-center gap-2">
          <ThemeToggle />

          {isLoading ? null : user ? (
            <>
              <Button
                variant="ghost"
                size="sm"
                render={
                  <Link href="/posts/new">
                    <PenSquare className="mr-1 h-4 w-4" />
                    글쓰기
                  </Link>
                }
              />

              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="sm">
                      {user.name}
                    </Button>
                  }
                />
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    render={
                      <Link href="/my/posts">
                        <UserIcon className="mr-2 h-4 w-4" />
                        마이페이지
                      </Link>
                    }
                  />
                  {user.role === "ADMIN" && (
                    <DropdownMenuItem
                      render={
                        <Link href="/admin">
                          <LayoutDashboard className="mr-2 h-4 w-4" />
                          관리자
                        </Link>
                      }
                    />
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut({ callbackUrl: "/" })}>
                    <LogOut className="mr-2 h-4 w-4" />
                    로그아웃
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" render={<Link href="/login">로그인</Link>} />
              <Button size="sm" render={<Link href="/signup">회원가입</Link>} />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
