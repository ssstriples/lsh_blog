"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDeletePost } from "@/hooks/usePostMutations";

interface PostOwnerActionsProps {
  postId: string;
  slug: string;
  authorId: string;
}

/** 게시글 작성자 본인(또는 ADMIN)에게만 수정/삭제 버튼을 노출한다. */
export function PostOwnerActions({ postId, slug, authorId }: PostOwnerActionsProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const deleteMutation = useDeletePost();

  const canManage =
    session?.user && (session.user.id === authorId || session.user.role === "ADMIN");

  if (!canManage) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        nativeButton={false}
        render={<Link href={`/posts/${postId}/edit`} />}
      >
        <Pencil className="h-4 w-4" />
        수정
      </Button>
      <Button
        variant="destructive"
        size="sm"
        disabled={deleteMutation.isPending}
        onClick={() => {
          if (!window.confirm("이 게시글을 삭제하시겠습니까?")) return;
          deleteMutation.mutate(
            { id: postId, slug },
            {
              onSuccess: () => {
                toast.success("게시글이 삭제되었습니다.");
                router.push("/");
              },
              onError: (error) => toast.error(error.message),
            },
          );
        }}
      >
        <Trash2 className="h-4 w-4" />
        삭제
      </Button>
    </div>
  );
}
