"use client";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { TableKit } from "@tiptap/extension-table";
import { Placeholder } from "@tiptap/extensions";
import { common, createLowlight } from "lowlight";

import { EditorToolbar } from "@/components/write/EditorToolbar";

// highlight.js의 "자주 쓰는 언어" 묶음 — 에디터 안에서의 미리보기용 하이라이팅.
// 실제 게시글 화면은 Shiki로 다시 하이라이팅한다 (lib/renderPostContent.ts).
const lowlight = createLowlight(common);

interface RichTextEditorProps {
  /** 최초 1회만 반영된다 — 외부에서 내용을 통째로 바꾸려면 key를 바꿔 다시 마운트한다. */
  initialContent: string;
  onChange: (html: string) => void;
}

export function RichTextEditor({ initialContent, onChange }: RichTextEditorProps) {
  const editor = useEditor({
    // Next.js SSR에서 hydration 불일치를 막기 위해 클라이언트 마운트 후에 렌더링한다.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        codeBlock: false, // CodeBlockLowlight로 대체
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      CodeBlockLowlight.configure({ lowlight, defaultLanguage: "plaintext" }),
      Image,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({ placeholder: "본문을 작성하세요..." }),
    ],
    content: initialContent,
    editorProps: {
      attributes: {
        class:
          "tiptap-editor prose prose-neutral dark:prose-invert max-w-none min-h-[420px] px-4 py-3 focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  return (
    <div className="border-input rounded-lg border">
      {editor ? <EditorToolbar editor={editor} /> : <div className="bg-muted/30 h-10 border-b" />}
      <EditorContent editor={editor} />
    </div>
  );
}
