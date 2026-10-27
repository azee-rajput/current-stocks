"use client";
import { useCallback, useEffect, useState } from "react";

const KEY = "pk-markets-watchlist";
const EVENT = "pk-watchlist-change";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Watchlist of ids ("OGDC" for stocks, "asset:gold" for commodities/currencies) kept in this browser. */
export function useWatchlist() {
  const [items, setItems] = useState<string[]>([]);
  useEffect(() => {
    setItems(read());
    const sync = () => setItems(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const toggle = useCallback((id: string) => {
    const cur = read();
    const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return { items, has: (id: string) => items.includes(id), toggle };
}
