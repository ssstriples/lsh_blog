"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { apiFetch } from "@/lib/api";

interface PostOwnerActionsProps {
  postId: string;
  authorId: string;
}

/** 게시글 작성자 본인(또는 ADMIN)에게만 수정/삭제 버튼을 노출한다. */
export function PostOwnerActions({ postId, authorId }: PostOwnerActionsProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const canManage = session?.user && (session.user.id === authorId || session.user.role === "ADMIN");

  const deleteMutation = useMutation({
    mutationFn: () =>
      apiFetch(`/api/posts/${postId}`, { method: "DELETE", accessToken: session?.accessToken }),
    onSuccess: () => {
      toast.success("게시글이 삭제되었습니다.");
      router.push("/");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (!canManage) return null;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" render={<Link href={`/posts/${postId}/edit`} />}>
        <Pencil className="h-4 w-4" />
        수정
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={deleteMutation.isPending}
        onClick={() => {
          if (window.confirm("이 게시글을 삭제하시겠습니까?")) {
            deleteMutation.mutate();
          }
        }}
      >
        <Trash2 className="h-4 w-4" />
        삭제
      </Button>
    </div>
  );
}
