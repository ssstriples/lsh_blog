/** `{ page: 2, q: "" }` → `"?page=2"` — 값이 비어있는 키는 제외한다. */
export function toQueryString(params: object): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") search.set(key, String(value));
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}
