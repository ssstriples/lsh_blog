"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sparkles } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAiStatus, useGenerateAiDraft, type AiDraft } from "@/hooks/useAiDraft";

/** 백엔드 blogDraftRequestSchema와 같은 제한 */
const IDEA_MAX = 2000;
const SOURCE_MAX = 60000;

const textareaClass =
  "w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

interface AiDraftDialogProps {
  /** 미리보기에서 "에디터에 넣기"를 눌렀을 때 — 덮어쓰기 확인은 호출하는 쪽(PostEditor)이 한다 */
  onApply: (draft: AiDraft) => void;
}

/**
 * 🛡️ 관리자 전용 "AI 초안 생성" (T085) — 파이프라인 3단계.
 * 생성은 비용이 드는 작업이라 바로 덮어쓰지 않고, 제목/요약/태그를 먼저 보여준 뒤 사람이 적용을 결정한다.
 */
export function AiDraftDialog({ onApply }: AiDraftDialogProps) {
  const { data: aiStatus, isPending: isStatusPending } = useAiStatus();
  const generateMutation = useGenerateAiDraft();

  const [open, setOpen] = useState(false);
  const [idea, setIdea] = useState("");
  const [sourceDocument, setSourceDocument] = useState("");
  const [result, setResult] = useState<AiDraft | null>(null);

  const enabled = aiStatus?.enabled ?? false;

  function handleGenerate() {
    if (idea.trim().length < 5) {
      toast.error("글감은 5자 이상 입력해주세요.");
      return;
    }
    setResult(null);
    generateMutation.mutate(
      { idea: idea.trim(), sourceDocument: sourceDocument.trim() || undefined },
      {
        onSuccess: (draft) => setResult(draft),
        onError: (err) => toast.error(err.message),
      },
    );
  }

  function handleApply() {
    if (!result) return;
    onApply(result);
    setOpen(false);
    setResult(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // 생성 중에는 닫지 않는다 (요청은 이미 비용이 발생 중)
        if (!generateMutation.isPending) setOpen(next);
      }}
    >
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isStatusPending || !enabled}
        title={enabled ? undefined : "서버에 AI 키(ANTHROPIC_API_KEY)가 설정되지 않았습니다"}
        onClick={() => setOpen(true)}
      >
        <Sparkles className="h-4 w-4" />
        AI 초안 생성
      </Button>
      {!isStatusPending && !enabled && (
        <span className="text-muted-foreground text-xs">AI 키 미설정</span>
      )}

      <DialogContent className="sm:max-w-2xl" showCloseButton={!generateMutation.isPending}>
        <DialogHeader>
          <DialogTitle>AI 초안 생성</DialogTitle>
          <DialogDescription>
            글감을 적으면 제목·태그·본문 초안을 만들어 에디터에 넣어줍니다. 발행 전에 반드시 내용을
            확인하고 다듬어주세요. ({aiStatus?.model})
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="bg-muted/30 flex flex-col gap-3 rounded-lg border p-4 text-sm">
            <p className="text-base font-semibold">{result.title}</p>
            <p className="text-muted-foreground">{result.summary}</p>
            <div className="flex flex-wrap gap-1.5">
              {result.tags.map((tag) => (
                <Badge key={tag} variant="secondary">
                  #{tag}
                </Badge>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              본문 {result.html.replace(/<[^>]+>/g, "").length.toLocaleString("ko-KR")}자 · 토큰
              입력 {result.usage.inputTokens.toLocaleString("ko-KR")} / 출력{" "}
              {result.usage.outputTokens.toLocaleString("ko-KR")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              글감 (필수)
              <textarea
                rows={3}
                maxLength={IDEA_MAX}
                placeholder="예: Next.js 16에서 ISR과 revalidatePath로 게시글 캐시를 관리한 경험"
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                disabled={generateMutation.isPending}
                className={textareaClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              참고 자료 (선택)
              <span className="text-muted-foreground text-xs font-normal">
                docs/generated/의 요구조건·기술 명세서나 개발 로그를 붙여넣으면 그 내용을 바탕으로
                씁니다.
              </span>
              <textarea
                rows={6}
                maxLength={SOURCE_MAX}
                value={sourceDocument}
                onChange={(e) => setSourceDocument(e.target.value)}
                disabled={generateMutation.isPending}
                className={`${textareaClass} font-mono text-xs`}
              />
            </label>
          </div>
        )}

        <DialogFooter>
          {result ? (
            <>
              <Button type="button" variant="ghost" onClick={() => setResult(null)}>
                다시 생성
              </Button>
              <Button type="button" onClick={handleApply}>
                에디터에 넣기
              </Button>
            </>
          ) : (
            <Button type="button" disabled={generateMutation.isPending} onClick={handleGenerate}>
              <Sparkles className="h-4 w-4" />
              {generateMutation.isPending ? "생성 중... (1~2분 걸릴 수 있어요)" : "초안 생성"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
