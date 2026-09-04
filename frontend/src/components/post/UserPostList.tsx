"use client";

import { usePosts } from "@/hooks/usePosts";
import { PostGrid } from "@/components/post/PostGrid";

export function UserPostList({ userId, page }: { userId: string; page: number }) {
  // 별도의 "회원 정보" 조회 API가 없어, 목록의 첫 글에서 작성자 닉네임을 가져와 헤딩으로 사용한다.
  const { data } = usePosts({ authorId: userId, page: 1, limit: 1 });
  const authorName = data?.posts[0]?.author.name;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        {authorName ? `${authorName}님의 글` : "작성자 프로필"}
      </h1>
      <PostGrid page={page} basePath={`/users/${userId}`} authorId={userId} />
    </div>
  );
}
