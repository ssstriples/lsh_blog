import { notFound, redirect } from "next/navigation";

import { apiFetch, ApiError } from "@/lib/api";
import { auth } from "@/lib/auth";
import { PostEditor } from "@/components/write/PostEditor";
import type { PostDetail } from "@/types/post";

/**
 * `/posts/[id]/edit` — 🔑 작성자 본인(또는 ADMIN)만 접근 가능
 *
 * ⚠️ Next.js는 같은 위치의 동적 세그먼트 이름이 달라지는 것을 허용하지 않는다
 * (`/posts/[slug]`와 `/posts/[id]/edit` 공존 불가). 그래서 폴더는 `[slug]`를 공유하지만,
 * 이 페이지에서 들어오는 값은 slug가 아니라 **게시글 id**다.
 */
export default async function EditPostPage(props: PageProps<"/posts/[slug]/edit">) {
  const { slug: postId } = await props.params;
  const editPath = `/posts/${postId}/edit`;

  const session = await auth();
  if (!session?.user || session.error) {
    redirect(`/login?callbackUrl=${encodeURIComponent(editPath)}`);
  }

  let post: PostDetail;
  try {
    // 소유권 검증은 백엔드(requireOwnership)가 한다 — DRAFT 글도 포함해 내려준다.
    post = await apiFetch<PostDetail>(`/api/posts/${postId}/edit`, {
      accessToken: session.accessToken,
      cache: "no-store",
    });
  } catch (err) {
    // redirect()/notFound()는 내부적으로 특수한 에러를 throw하는 방식이라 catch 안에서 호출해도 된다.
    // (우리가 잡는 건 apiFetch의 ApiError뿐이고, 그 외 에러는 그대로 다시 던진다)
    if (err instanceof ApiError) {
      if (err.status === 401) redirect(`/login?callbackUrl=${encodeURIComponent(editPath)}`);
      if (err.status === 403) redirect("/403");
      if (err.status === 404) notFound();
    }
    throw err;
  }

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <PostEditor post={post} />
    </main>
  );
}
