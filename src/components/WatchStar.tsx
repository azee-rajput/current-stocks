"use client";
import { useWatchlist } from "@/lib/watchlist";

export default function WatchStar({ id, label }: { id: string; label?: string }) {
  const { has, toggle } = useWatchlist();
  const on = has(id);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(id);
      }}
      aria-pressed={on}
      title={on ? "Remove from watchlist" : "Add to watchlist"}
      className={`inline-flex items-center gap-1 rounded px-1 text-base leading-none ${on ? "text-[#eda100]" : "text-muted hover:text-text"}`}
    >
      {on ? "★" : "☆"}
      {label && <span className="text-sm">{on ? "Watching" : label}</span>}
    </button>
  );
}
