import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api";
import type { Category } from "@/types/taxonomy";

/** GET /api/categories — 전체 카테고리 목록 */
export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: () => apiFetch<Category[]>("/api/categories"),
  });
}
