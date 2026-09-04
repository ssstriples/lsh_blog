/** 서버에서 sanitize + 코드 하이라이팅까지 완료된 HTML을 그대로 렌더링한다 (`lib/renderPostContent.ts` 참고). */
export function PostContent({ html }: { html: string }) {
  return (
    <article
      className="prose prose-neutral max-w-none dark:prose-invert prose-headings:scroll-mt-20 prose-pre:bg-transparent prose-pre:p-0"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
