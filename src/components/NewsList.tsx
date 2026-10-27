import type { Headline } from "@/lib/news";
import { timeAgo } from "@/lib/format";

export default function NewsList({ items, limit = 10, inverted = false }: { items: Headline[]; limit?: number; inverted?: boolean }) {
  if (!items.length) return <p className="text-sm text-text-2">No recent headlines found.</p>;
  return (
    <ul className="divide-y divide-border">
      {items.slice(0, limit).map((h) => {
        const s = inverted ? -h.score : h.score;
        const tone = s > 0 ? { t: "Bullish", c: "text-up" } : s < 0 ? { t: "Bearish", c: "text-down" } : { t: "Neutral", c: "text-muted" };
        return (
          <li key={h.link} className="flex gap-3 py-2">
            <span className={`w-16 shrink-0 text-xs font-medium ${tone.c}`}>{s > 0 ? "▲" : s < 0 ? "▼" : "•"} {tone.t}</span>
            <div className="min-w-0">
              <a href={h.link} target="_blank" rel="noopener noreferrer" className="text-sm hover:text-accent">{h.title}</a>
              <div className="text-xs text-text-2">{h.source} · {h.published ? timeAgo(h.published) : ""}</div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
