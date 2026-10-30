"use client";

import { useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { useEditorState, type Editor } from "@tiptap/react";
import { toast } from "sonner";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Redo2,
  SquareCode,
  Strikethrough,
  Table as TableIcon,
  Underline,
  Undo2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { uploadImage } from "@/lib/uploadImage";

/** 게시글 화면의 Shiki 하이라이터(lib/renderPostContent.ts)가 로드하는 언어 목록과 맞춘다. */
const CODE_LANGUAGES = [
  "plaintext",
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
];

function ToolbarButton({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "text-muted-foreground hover:bg-muted hover:text-foreground inline-flex h-7 min-w-7 items-center justify-center rounded-md px-1.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        active && "bg-muted text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span aria-hidden className="bg-border mx-1 h-5 w-px" />;
}

export function EditorToolbar({ editor }: { editor: Editor }) {
  const { data: session } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  // 툴바 버튼의 활성 상태만 구독한다 — 에디터 트랜잭션마다 전체를 다시 렌더링하지 않도록.
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      underline: e.isActive("underline"),
      strike: e.isActive("strike"),
      code: e.isActive("code"),
      h1: e.isActive("heading", { level: 1 }),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bulletList: e.isActive("bulletList"),
      orderedList: e.isActive("orderedList"),
      blockquote: e.isActive("blockquote"),
      codeBlock: e.isActive("codeBlock"),
      codeLanguage: (e.getAttributes("codeBlock").language as string | undefined) ?? "plaintext",
      link: e.isActive("link"),
      table: e.isActive("table"),
      alignCenter: e.isActive({ textAlign: "center" }),
      alignRight: e.isActive({ textAlign: "right" }),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });

  function handleLink() {
    const previous = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("링크 URL을 입력하세요 (비우면 링크 제거)", previous ?? "https://");
    if (url === null) return;

    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  async function handleImageFile(file: File) {
    setIsUploading(true);
    try {
      const url = await uploadImage(file, session?.accessToken);
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "이미지 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  const chain = () => editor.chain().focus();

  return (
    <div className="bg-background/95 sticky top-14 z-10 flex flex-col gap-1 rounded-t-lg border-b px-2 py-1.5 backdrop-blur">
      <div className="flex flex-wrap items-center gap-0.5">
        <ToolbarButton
          label="실행 취소"
          disabled={!state.canUndo}
          onClick={() => chain().undo().run()}
        >
          <Undo2 />
        </ToolbarButton>
        <ToolbarButton
          label="다시 실행"
          disabled={!state.canRedo}
          onClick={() => chain().redo().run()}
        >
          <Redo2 />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="제목 1"
          active={state.h1}
          onClick={() => chain().toggleHeading({ level: 1 }).run()}
        >
          <Heading1 />
        </ToolbarButton>
        <ToolbarButton
          label="제목 2"
          active={state.h2}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          <Heading2 />
        </ToolbarButton>
        <ToolbarButton
          label="제목 3"
          active={state.h3}
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        >
          <Heading3 />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="굵게" active={state.bold} onClick={() => chain().toggleBold().run()}>
          <Bold />
        </ToolbarButton>
        <ToolbarButton
          label="기울임"
          active={state.italic}
          onClick={() => chain().toggleItalic().run()}
        >
          <Italic />
        </ToolbarButton>
        <ToolbarButton
          label="밑줄"
          active={state.underline}
          onClick={() => chain().toggleUnderline().run()}
        >
          <Underline />
        </ToolbarButton>
        <ToolbarButton
          label="취소선"
          active={state.strike}
          onClick={() => chain().toggleStrike().run()}
        >
          <Strikethrough />
        </ToolbarButton>
        <ToolbarButton
          label="인라인 코드"
          active={state.code}
          onClick={() => chain().toggleCode().run()}
        >
          <Code />
        </ToolbarButton>
        <ToolbarButton label="링크" active={state.link} onClick={handleLink}>
          <LinkIcon />
        </ToolbarButton>
        <Divider />
        <ToolbarButton label="왼쪽 정렬" onClick={() => chain().setTextAlign("left").run()}>
          <AlignLeft />
        </ToolbarButton>
        <ToolbarButton
          label="가운데 정렬"
          active={state.alignCenter}
          onClick={() => chain().setTextAlign("center").run()}
        >
          <AlignCenter />
        </ToolbarButton>
        <ToolbarButton
          label="오른쪽 정렬"
          active={state.alignRight}
          onClick={() => chain().setTextAlign("right").run()}
        >
          <AlignRight />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="글머리 목록"
          active={state.bulletList}
          onClick={() => chain().toggleBulletList().run()}
        >
          <List />
        </ToolbarButton>
        <ToolbarButton
          label="번호 목록"
          active={state.orderedList}
          onClick={() => chain().toggleOrderedList().run()}
        >
          <ListOrdered />
        </ToolbarButton>
        <ToolbarButton
          label="인용"
          active={state.blockquote}
          onClick={() => chain().toggleBlockquote().run()}
        >
          <Quote />
        </ToolbarButton>
        <ToolbarButton
          label="코드 블록"
          active={state.codeBlock}
          onClick={() => chain().toggleCodeBlock().run()}
        >
          <SquareCode />
        </ToolbarButton>
        <ToolbarButton label="구분선" onClick={() => chain().setHorizontalRule().run()}>
          <Minus />
        </ToolbarButton>
        <Divider />
        <ToolbarButton
          label="표 삽입"
          active={state.table}
          onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon />
        </ToolbarButton>
        <ToolbarButton
          label={isUploading ? "업로드 중..." : "이미지 업로드"}
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <ImagePlus />
        </ToolbarButton>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ""; // 같은 파일을 다시 선택해도 onChange가 뜨도록 초기화
            if (file) void handleImageFile(file);
          }}
        />
      </div>

      {/* 커서 위치에 따라 나타나는 보조 툴바 — 코드 블록 언어 / 표 편집 */}
      {(state.codeBlock || state.table) && (
        <div className="flex flex-wrap items-center gap-1 border-t pt-1.5 text-xs">
          {state.codeBlock && (
            <label className="text-muted-foreground flex items-center gap-1.5">
              언어
              <select
                value={state.codeLanguage}
                onChange={(e) =>
                  chain().updateAttributes("codeBlock", { language: e.target.value }).run()
                }
                className="border-input bg-background text-foreground h-7 rounded-md border px-1.5"
              >
                {CODE_LANGUAGES.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </label>
          )}
          {state.table && (
            <>
              <ToolbarButton label="아래에 행 추가" onClick={() => chain().addRowAfter().run()}>
                + 행
              </ToolbarButton>
              <ToolbarButton
                label="오른쪽에 열 추가"
                onClick={() => chain().addColumnAfter().run()}
              >
                + 열
              </ToolbarButton>
              <ToolbarButton label="행 삭제" onClick={() => chain().deleteRow().run()}>
                − 행
              </ToolbarButton>
              <ToolbarButton label="열 삭제" onClick={() => chain().deleteColumn().run()}>
                − 열
              </ToolbarButton>
              <ToolbarButton label="표 삭제" onClick={() => chain().deleteTable().run()}>
                표 삭제
              </ToolbarButton>
            </>
          )}
        </div>
      )}
    </div>
  );
}
