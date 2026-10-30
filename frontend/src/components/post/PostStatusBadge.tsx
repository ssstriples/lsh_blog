import { Badge } from "@/components/ui/badge";
import type { PostStatus } from "@/types/post";

export function PostStatusBadge({ status }: { status: PostStatus }) {
  return status === "PUBLISHED" ? (
    <Badge>발행됨</Badge>
  ) : (
    <Badge variant="secondary">임시저장</Badge>
  );
}
