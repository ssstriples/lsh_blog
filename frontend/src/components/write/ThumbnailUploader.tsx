"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { uploadImage } from "@/lib/uploadImage";

interface ThumbnailUploaderProps {
  value: string | null;
  onChange: (url: string | null) => void;
}

export function ThumbnailUploader({ value, onChange }: ThumbnailUploaderProps) {
  const { data: session } = useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleFile(file: File) {
    setIsUploading(true);
    try {
      onChange(await uploadImage(file, session?.accessToken));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "썸네일 업로드에 실패했습니다.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="flex items-start gap-3">
      {value ? (
        <div className="relative aspect-video w-48 overflow-hidden rounded-lg border">
          <Image src={value} alt="썸네일 미리보기" fill sizes="192px" className="object-cover" />
          <button
            type="button"
            aria-label="썸네일 제거"
            onClick={() => onChange(null)}
            className="bg-background/80 hover:bg-background absolute top-1 right-1 rounded-full p-1"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={isUploading}
        onClick={() => inputRef.current?.click()}
      >
        <ImagePlus className="h-4 w-4" />
        {isUploading ? "업로드 중..." : value ? "썸네일 변경" : "썸네일 업로드"}
      </Button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void handleFile(file);
        }}
      />
    </div>
  );
}
