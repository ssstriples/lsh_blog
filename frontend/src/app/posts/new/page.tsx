import { PostEditor } from "@/components/write/PostEditor";

// 🔒 로그인 필요 — 비로그인 접근은 proxy.ts에서 /login으로 리다이렉트한다.
export default function NewPostPage() {
  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
      <PostEditor />
    </main>
  );
}
