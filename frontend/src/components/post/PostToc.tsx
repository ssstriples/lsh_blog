import type { TocItem } from "@/types/post";

export function PostToc({ items }: { items: TocItem[] }) {
  if (items.length === 0) return null;

  const minLevel = Math.min(...items.map((item) => item.level));

  return (
    <nav aria-label="목차" className="sticky top-20 hidden w-56 shrink-0 lg:block">
      <p className="mb-2 text-sm font-medium text-foreground">목차</p>
      <ul className="flex flex-col gap-1.5 border-l text-sm text-muted-foreground">
        {items.map((item) => (
          <li key={item.id} style={{ paddingLeft: `${(item.level - minLevel) * 0.75 + 0.75}rem` }}>
            <a href={`#${item.id}`} className="line-clamp-1 hover:text-foreground">
              {item.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
