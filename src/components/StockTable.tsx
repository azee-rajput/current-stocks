"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Change, ShariahBadge, SignalBadge } from "./ui";
import WatchStar from "./WatchStar";
import { useWatchlist } from "@/lib/watchlist";
import { fmt, fmtCompact } from "@/lib/format";
import type { Signal } from "@/lib/analytics";

export type StockRow = {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  threeDay?: number | null;
  volume: number;
  marketCapM: number;
  weight?: number;
  shariah: boolean;
  sector?: string;
  ytd?: number | null;
  change1y?: number | null;
  pe?: number | null;
  stability?: number | null;
  signal?: Signal;
  divFrequency?: string;
  divYield?: number | null;
};

type Key = "symbol" | "price" | "changePct" | "threeDay" | "volume" | "marketCapM" | "weight" | "ytd" | "change1y" | "pe" | "stability" | "score" | "divYield";

const DIV_SCHEDULES = ["Monthly", "Quarterly", "Half-yearly", "Annual"];

export default function StockTable({ rows, initialFilter = "all", showShariahFilter = true, pageSize = 50 }: {
  rows: StockRow[]; initialFilter?: "all" | "shariah" | "watch"; showShariahFilter?: boolean; pageSize?: number;
}) {
  const { has } = useWatchlist();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState(initialFilter);
  const [sector, setSector] = useState("");
  const [divFilter, setDivFilter] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "marketCapM", dir: -1 });
  const [limit, setLimit] = useState(pageSize);

  const sectors = useMemo(() => [...new Set(rows.map((r) => r.sector).filter(Boolean) as string[])].sort(), [rows]);
  const hasCol = (k: keyof StockRow) => rows.some((r) => r[k] != null);

  const view = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const val = (r: StockRow): number | string => (sort.key === "symbol" ? r.symbol : sort.key === "score" ? r.signal?.score ?? -999 : (r[sort.key] as number | null) ?? -Infinity);
    return rows
      .filter((r) => !needle || r.symbol.toLowerCase().includes(needle) || r.name.toLowerCase().includes(needle))
      .filter((r) => filter === "all" || (filter === "shariah" ? r.shariah : has(r.symbol)))
      .filter((r) => !sector || r.sector === sector)
      .filter((r) => !divFilter || (divFilter === "any" ? DIV_SCHEDULES.includes(r.divFrequency ?? "") : r.divFrequency === divFilter))
      .sort((a, b) => {
        const x = val(a);
        const y = val(b);
        return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
      });
  }, [rows, q, filter, sector, divFilter, sort, has]);

  const th = (key: Key, label: string, right = true) => (
    <th className={`px-3 py-2 font-medium ${right ? "text-right" : "text-left"}`} aria-sort={sort.key === key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button className="hover:text-text" onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}>
        {label} {sort.key === key ? (sort.dir === 1 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search symbol or company…"
          className="w-full rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm outline-none focus:border-accent sm:w-64" />
        <div className="flex rounded-lg bg-surface-2 p-0.5 text-xs">
          {(["all", ...(showShariahFilter ? ["shariah"] : []), "watch"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f as typeof filter)}
              className={`rounded-md px-2.5 py-1 font-medium ${filter === f ? "bg-surface text-text shadow-sm" : "text-text-2"}`}>
              {f === "all" ? "All" : f === "shariah" ? "Shariah only" : "★ Watchlist"}
            </button>
          ))}
        </div>
        {sectors.length > 0 && (
          <select value={sector} onChange={(e) => setSector(e.target.value)} className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs">
            <option value="">All sectors</option>
            {sectors.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {hasCol("divFrequency") && (
          <select value={divFilter} onChange={(e) => setDivFilter(e.target.value)} className="rounded-md border border-border bg-surface-2 px-2 py-1.5 text-xs" aria-label="Dividend schedule">
            <option value="">Any dividend schedule</option>
            <option value="any">Pays regular dividends</option>
            {DIV_SCHEDULES.map((s) => <option key={s} value={s}>Pays {s.toLowerCase()}</option>)}
          </select>
        )}
        <span className="ml-auto text-xs text-text-2">{view.length} stocks</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 text-xs text-text-2">
            <tr>
              <th className="w-8" />
              {th("symbol", "Symbol", false)}
              {th("price", "Price")}
              {th("changePct", "Today")}
              {hasCol("threeDay") && th("threeDay", "3 days")}
              {hasCol("ytd") && th("ytd", "YTD")}
              {hasCol("change1y") && th("change1y", "1 Year")}
              {hasCol("pe") && th("pe", "P/E")}
              {th("volume", "Volume")}
              {th("marketCapM", "Mkt cap")}
              {hasCol("weight") && th("weight", "Index wt")}
              {hasCol("divFrequency") && <th className="px-3 py-2 text-left font-medium">Dividend</th>}
              {hasCol("divFrequency") && th("divYield", "Div. yield")}
              {hasCol("stability") && th("stability", "Stability")}
              {hasCol("signal") && th("score", "Outlook")}
            </tr>
          </thead>
          <tbody>
            {view.slice(0, limit).map((r) => (
              <tr key={r.symbol} className="border-t border-border hover:bg-surface-2">
                <td className="pl-2"><WatchStar id={r.symbol} /></td>
                <td className="px-3 py-2">
                  <Link href={`/stock/${r.symbol}`} className="font-semibold hover:text-accent">{r.symbol}</Link>{" "}
                  {r.shariah && <ShariahBadge />}
                  <div className="max-w-56 truncate text-xs text-text-2">{r.name}</div>
                </td>
                <td className="num px-3 py-2 text-right">{fmt(r.price)}</td>
                <td className="px-3 py-2 text-right"><Change value={r.changePct} /></td>
                {hasCol("threeDay") && <td className="px-3 py-2 text-right"><Change value={r.threeDay} /></td>}
                {hasCol("ytd") && <td className="px-3 py-2 text-right"><Change value={r.ytd} /></td>}
                {hasCol("change1y") && <td className="px-3 py-2 text-right"><Change value={r.change1y} /></td>}
                {hasCol("pe") && <td className="num px-3 py-2 text-right">{fmt(r.pe, 1)}</td>}
                <td className="num px-3 py-2 text-right">{fmtCompact(r.volume)}</td>
                <td className="num px-3 py-2 text-right">{fmtCompact(r.marketCapM * 1e6)}</td>
                {hasCol("weight") && <td className="num px-3 py-2 text-right">{fmt(r.weight)}%</td>}
                {hasCol("divFrequency") && (
                  <td className={`px-3 py-2 text-xs whitespace-nowrap ${DIV_SCHEDULES.includes(r.divFrequency ?? "") ? "" : "text-muted"}`}>{r.divFrequency ?? "—"}</td>
                )}
                {hasCol("divFrequency") && <td className="num px-3 py-2 text-right">{r.divYield ? `${fmt(r.divYield, 1)}%` : "—"}</td>}
                {hasCol("stability") && <td className="num px-3 py-2 text-right">{r.stability ?? "—"}</td>}
                {hasCol("signal") && <td className="px-3 py-2 text-right">{r.signal && <SignalBadge signal={r.signal} compact />}</td>}
              </tr>
            ))}
            {!view.length && (
              <tr><td colSpan={12} className="p-6 text-center text-text-2">{filter === "watch" ? "No stocks starred yet. Click ☆ next to a stock to add it." : "No matches."}</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {view.length > limit && (
        <button onClick={() => setLimit((l) => l + pageSize)} className="w-full border-t border-border py-2 text-sm text-accent hover:bg-surface-2">
          Show more ({view.length - limit} remaining)
        </button>
      )}
    </div>
  );
}
