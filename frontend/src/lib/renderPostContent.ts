import DOMPurify from "isomorphic-dompurify";
import { createHighlighter } from "shiki";
import type { TocItem } from "@/types/post";

/** 백엔드(backend/src/services/postService.ts)의 sanitize 옵션과 동일하게 맞춘다 — TipTap/Shiki 마크업 허용. */
function sanitize(html: string): string {
  return DOMPurify.sanitize(html, {
    ADD_TAGS: ["iframe"],
    ADD_ATTR: ["target", "rel", "class", "data-language", "style"],
  });
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, "").trim();
}

/** 한글을 보존하는 헤딩 slug 생성 (backend `postService.ts`의 태그 slug 생성 방식과 동일한 접근) */
function slugifyHeading(text: string, index: number): string {
  const base = text
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-가-힣]/g, "");
  return base ? `${base}-${index}` : `heading-${index}`;
}

/** 본문 헤딩에 anchor용 id를 부여하고, 목차(TOC) 목록을 함께 추출한다. */
function injectHeadingIds(html: string): { html: string; toc: TocItem[] } {
  const toc: TocItem[] = [];
  let index = 0;

  const result = html.replace(
    /<h([1-6])([^>]*)>([\s\S]*?)<\/h\1>/g,
    (match, level: string, attrs: string, inner: string) => {
      const text = stripTags(inner);
      if (!text) return match;

      const id = slugifyHeading(text, index++);
      toc.push({ id, text, level: Number(level) });

      const cleanedAttrs = attrs.replace(/\sid="[^"]*"/g, "");
      return `<h${level}${cleanedAttrs} id="${id}">${inner}</h${level}>`;
    },
  );

  return { html: result, toc };
}

let highlighterPromise: ReturnType<typeof createHighlighter> | null = null;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: ["github-light", "github-dark"],
      langs: [
        "javascript",
        "typescript",
        "jsx",
        "tsx",
        "json",
        "bash",
        "css",
        "html",
        "sql",
        "python",
        "yaml",
        "markdown",
        "plaintext",
      ],
    });
  }
  return highlighterPromise;
}

/** `<pre><code class="language-xxx">...</code></pre>` 코드 블록을 Shiki로 하이라이팅한다. */
async function highlightCodeBlocks(html: string): Promise<string> {
  const highlighter = await getHighlighter();
  const codeBlockPattern = /<pre>\s*<code(?:\s+class="language-([\w-]*)")?[^>]*>([\s\S]*?)<\/code>\s*<\/pre>/g;

  const matches = [...html.matchAll(codeBlockPattern)];
  if (matches.length === 0) return html;

  let result = html;
  for (const match of matches) {
    const [full, lang, rawCode] = match;
    const code = decodeEntities(rawCode);
    const loadedLangs = highlighter.getLoadedLanguages();
    const resolvedLang = lang && loadedLangs.includes(lang) ? lang : "plaintext";

    const highlighted = highlighter.codeToHtml(code, {
      lang: resolvedLang,
      themes: { light: "github-light", dark: "github-dark" },
      defaultColor: false,
    });

    result = result.replace(full, highlighted);
  }

  return result;
}

/** 게시글 본문(HTML)을 렌더링용으로 가공한다: sanitize → 헤딩 id/TOC 추출 → 코드 하이라이팅. */
export async function renderPostContent(rawHtml: string): Promise<{ html: string; toc: TocItem[] }> {
  const sanitized = sanitize(rawHtml);
  const { html: withIds, toc } = injectHeadingIds(sanitized);
  const highlighted = await highlightCodeBlocks(withIds);

  return { html: highlighted, toc };
}
