/** "2026년 10월 31일" 형식 */
export function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
