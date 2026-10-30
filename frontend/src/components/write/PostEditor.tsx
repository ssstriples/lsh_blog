"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PostStatusBadge } from "@/components/post/PostStatusBadge";
import { RichTextEditor } from "@/components/write/RichTextEditor";
import { TagInput } from "@/components/write/TagInput";
import { ThumbnailUploader } from "@/components/write/ThumbnailUploader";
import { useCategories } from "@/hooks/useCategories";
import { useDeletePost, useSavePost } from "@/hooks/usePostMutations";
import { useDraftStore, type PostDraft } from "@/store/draftStore";
import type { PostDetail, PostInput, PostStatus } from "@/types/post";

/** localStorage 자동저장 간격 */
const AUTOSAVE_INTERVAL_MS = 30 * 1000;
/** 백엔드 createPostSchema의 slug 규칙과 동일 */
const SLUG_PATTERN = /^[a-z0-9-]+$/;

type DraftFields = Omit<PostDraft, "savedAt">;

/** 변경 여부 비교용 직렬화 — 같은 내용이면 같은 문자열이 나온다. */
function toSnapshot(fields: DraftFields): string {
  const { title, slug, categoryId, tags, thumbnailUrl, content } = fields;
  return JSON.stringify({ title, slug, categoryId, tags, thumbnailUrl, content });
}

/** TipTap은 빈 문서도 `<p></p>`를 내보내므로, 글자/이미지가 하나도 없으면 빈 본문으로 본다. */
function isEmptyContent(html: string): boolean {
  return !/<img\s/i.test(html) && html.replace(/<[^>]+>/g, "").trim() === "";
}

function formatSavedAgo(savedAt: number, now: number): string {
  const minutes = Math.floor((now - savedAt) / 60_000);
  if (minutes < 1) return "방금 전";
  if (minutes < 60) return `${minutes}분 전`;
  return new Date(savedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
}

function toFields(post?: PostDetail): DraftFields {
  return {
    title: post?.title ?? "",
    slug: post?.slug ?? "",
    categoryId: post?.category?.id ?? "",
    tags: post?.tags.map(({ tag }) => tag.name) ?? [],
    thumbnailUrl: post?.thumbnailUrl ?? null,
    content: post?.content ?? "",
  };
}

/** `/posts/new`(post 없음)와 `/posts/[id]/edit`(post 있음)이 함께 쓰는 글쓰기 폼 */
export function PostEditor({ post }: { post?: PostDetail }) {
  const router = useRouter();
  const { data: session } = useSession();
  const { data: categories } = useCategories();
  const saveMutation = useSavePost();
  const deleteMutation = useDeletePost();
  const saveDraft = useDraftStore((s) => s.saveDraft);
  const clearDraft = useDraftStore((s) => s.clearDraft);

  const initial = toFields(post);
  const initialSnapshot = toSnapshot(initial);

  const [title, setTitle] = useState(initial.title);
  const [slug, setSlug] = useState(initial.slug);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [tags, setTags] = useState(initial.tags);
  const [thumbnailUrl, setThumbnailUrl] = useState(initial.thumbnailUrl);
  const [content, setContent] = useState(initial.content);
  /** 서버에 저장된 현재 상태 — 새 글이면 null */
  const [serverStatus, setServerStatus] = useState<PostStatus | null>(post?.status ?? null);
  /** 서버에 저장된 현재 slug — slug를 바꿔 저장하면 이전 주소의 ISR 캐시도 지워야 한다 */
  const [serverSlug, setServerSlug] = useState(post?.slug);
  /** 복원 시 에디터를 새 내용으로 다시 마운트하기 위한 key */
  const [editorKey, setEditorKey] = useState(0);
  const [restoreCandidate, setRestoreCandidate] = useState<PostDraft | null>(null);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const fields: DraftFields = { title, slug, categoryId, tags, thumbnailUrl, content };
  const draftKey = session?.user ? `${session.user.id}:${post?.id ?? "new"}` : null;

  const latestFieldsRef = useRef(fields);
  const lastSnapshotRef = useRef(initialSnapshot);
  const hydratedRef = useRef(false);

  useEffect(() => {
    latestFieldsRef.current = fields;
  });

  // 1) 마운트 시 localStorage에서 원고를 불러와, 서버 내용과 다르면 "복원할까요?" 배너를 띄운다.
  useEffect(() => {
    if (!draftKey) return;
    let cancelled = false;

    void Promise.resolve(useDraftStore.persist.rehydrate()).then(() => {
      if (cancelled) return;
      hydratedRef.current = true;
      const saved = useDraftStore.getState().drafts[draftKey];
      if (saved && toSnapshot(saved) !== initialSnapshot) setRestoreCandidate(saved);
    });

    return () => {
      cancelled = true;
    };
  }, [draftKey, initialSnapshot]);

  // 2) 30초마다 마지막 저장 이후 바뀐 내용이 있을 때만 localStorage에 자동저장한다.
  useEffect(() => {
    if (!draftKey) return;

    const timer = setInterval(() => {
      setNow(Date.now());
      // rehydrate 전에 저장하면 비어있는 상태로 다른 글의 원고까지 덮어쓰게 된다.
      if (!hydratedRef.current) return;

      const current = latestFieldsRef.current;
      const snapshot = toSnapshot(current);
      if (snapshot === lastSnapshotRef.current) return;

      const savedAt = Date.now();
      saveDraft(draftKey, { ...current, savedAt });
      lastSnapshotRef.current = snapshot;
      setLastAutoSavedAt(savedAt);
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [draftKey, saveDraft]);

  function handleRestore(draft: PostDraft) {
    setTitle(draft.title);
    setSlug(draft.slug);
    setCategoryId(draft.categoryId);
    setTags(draft.tags);
    setThumbnailUrl(draft.thumbnailUrl);
    setContent(draft.content);
    setEditorKey((k) => k + 1);
    setRestoreCandidate(null);
    toast.success("자동저장된 원고를 불러왔습니다.");
  }

  function handleDiscard() {
    if (draftKey) clearDraft(draftKey);
    setRestoreCandidate(null);
  }

  function validate(): string | null {
    if (!title.trim()) return "제목을 입력해주세요.";
    if (isEmptyContent(content)) return "본문을 입력해주세요.";
    if (slug.trim() && !SLUG_PATTERN.test(slug.trim())) {
      return "슬러그는 영문 소문자, 숫자, 하이픈(-)만 사용할 수 있습니다.";
    }
    return null;
  }

  function handleSave(status: PostStatus) {
    const error = validate();
    if (error) {
      toast.error(error);
      return;
    }

    const input: PostInput = {
      title: title.trim(),
      content,
      slug: slug.trim() || undefined, // 비워두면 서버가 제목으로 자동 생성 (수정 시엔 기존 slug 유지)
      categoryId: categoryId || null,
      tags,
      thumbnailUrl,
      status,
    };

    saveMutation.mutate(
      { id: post?.id, input, previousSlug: serverSlug },
      {
        onSuccess: (saved) => {
          if (draftKey) clearDraft(draftKey);
          lastSnapshotRef.current = toSnapshot(latestFieldsRef.current);
          setLastAutoSavedAt(null);

          if (status === "PUBLISHED") {
            toast.success("게시글이 발행되었습니다.");
            router.push(`/posts/${saved.slug}`);
            return;
          }

          toast.success("임시저장되었습니다. (비공개)");
          if (!post) {
            // 새 글을 임시저장했다면 이후 저장이 중복 생성되지 않도록 수정 화면으로 이동한다.
            router.replace(`/posts/${saved.id}/edit`);
            return;
          }
          setServerStatus(saved.status);
          setServerSlug(saved.slug);
          setSlug(saved.slug);
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleDelete() {
    if (!post || !serverSlug) return;
    if (!window.confirm("이 게시글을 삭제하시겠습니까?")) return;

    deleteMutation.mutate(
      { id: post.id, slug: serverSlug },
      {
        onSuccess: () => {
          if (draftKey) clearDraft(draftKey);
          toast.success("게시글이 삭제되었습니다.");
          router.push("/my/posts");
        },
        onError: (err) => toast.error(err.message),
      },
    );
  }

  const isBusy = saveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">{post ? "글 수정" : "새 글 작성"}</h1>
        {serverStatus && <PostStatusBadge status={serverStatus} />}
      </div>

      {restoreCandidate && (
        <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed px-4 py-3 text-sm">
          <span>
            저장하지 않은 원고가 있습니다 ({formatSavedAgo(restoreCandidate.savedAt, now)}{" "}
            자동저장).
          </span>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => handleRestore(restoreCandidate)}>
              불러오기
            </Button>
            <Button size="sm" variant="ghost" onClick={handleDiscard}>
              버리기
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4">
        <Input
          aria-label="제목"
          placeholder="제목을 입력하세요"
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-11 text-lg font-medium md:text-lg"
        />

        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="slug" className="text-sm font-medium">
              슬러그
            </label>
            <Input
              id="slug"
              placeholder="비워두면 제목으로 자동 생성"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase())}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="category" className="text-sm font-medium">
              카테고리
            </label>
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border-input focus-visible:border-ring focus-visible:ring-ring/50 dark:bg-input/30 h-8 w-full rounded-lg border bg-transparent px-2.5 text-sm outline-none focus-visible:ring-3"
            >
              <option value="">카테고리 없음</option>
              {categories?.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="tags" className="text-sm font-medium">
            태그
          </label>
          <TagInput value={tags} onChange={setTags} />
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">썸네일</span>
          <ThumbnailUploader value={thumbnailUrl} onChange={setThumbnailUrl} />
        </div>
      </div>

      <RichTextEditor key={editorKey} initialContent={content} onChange={setContent} />

      <div className="bg-background/95 sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t py-3 backdrop-blur">
        <p className="text-muted-foreground text-sm">
          {lastAutoSavedAt
            ? `${formatSavedAgo(lastAutoSavedAt, now)} 브라우저에 자동저장됨`
            : "작성 중인 내용은 30초마다 브라우저에 자동저장됩니다."}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {post && (
            <Button variant="destructive" disabled={isBusy} onClick={handleDelete}>
              <Trash2 className="h-4 w-4" />
              삭제
            </Button>
          )}
          <Button variant="outline" disabled={isBusy} onClick={() => handleSave("DRAFT")}>
            {serverStatus === "PUBLISHED" ? "비공개로 저장" : "임시저장"}
          </Button>
          <Button disabled={isBusy} onClick={() => handleSave("PUBLISHED")}>
            {serverStatus === "PUBLISHED" ? "수정 내용 발행" : "발행하기"}
          </Button>
        </div>
      </div>
    </div>
  );
}
