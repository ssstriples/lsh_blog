"use client";

import { useState } from "react";
import { X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTags } from "@/hooks/useTags";

/** 백엔드 createPostSchema의 태그 최대 개수와 동일 */
const MAX_TAGS = 10;

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
}

/** Enter 또는 쉼표(,)로 태그를 추가한다. 기존 태그는 datalist로 자동완성 제안. 새 태그는 저장 시 서버가 upsert한다. */
export function TagInput({ value, onChange }: TagInputProps) {
  const { data: existingTags } = useTags();
  const [draft, setDraft] = useState("");

  function addTag(raw: string) {
    const name = raw.trim().replace(/^#/, "");
    setDraft("");
    if (!name || value.includes(name) || value.length >= MAX_TAGS) return;
    onChange([...value, name]);
  }

  return (
    <div className="flex flex-col gap-2">
      <Input
        id="tags"
        list="tag-suggestions"
        placeholder={value.length >= MAX_TAGS ? `태그는 최대 ${MAX_TAGS}개` : "태그 입력 후 Enter"}
        disabled={value.length >= MAX_TAGS}
        value={draft}
        onChange={(e) => {
          const next = e.target.value;
          if (next.endsWith(",")) addTag(next.slice(0, -1));
          else setDraft(next);
        }}
        onKeyDown={(e) => {
          // 한글 IME 조합 중 Enter는 무시해야 마지막 글자가 중복 입력되지 않는다.
          if (e.key === "Enter" && !e.nativeEvent.isComposing) {
            e.preventDefault();
            addTag(draft);
          } else if (e.key === "Backspace" && draft === "" && value.length > 0) {
            onChange(value.slice(0, -1));
          }
        }}
      />
      <datalist id="tag-suggestions">
        {existingTags
          ?.filter((tag) => !value.includes(tag.name))
          .map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
      </datalist>

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {value.map((tag) => (
            <Badge key={tag} variant="secondary" className="gap-1 pr-1">
              #{tag}
              <button
                type="button"
                aria-label={`${tag} 태그 제거`}
                onClick={() => onChange(value.filter((t) => t !== tag))}
                className="hover:bg-background/60 rounded-full"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
