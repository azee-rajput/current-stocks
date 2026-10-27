"use client";
import { useMemo, useState } from "react";
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Point } from "@/lib/history";
import { fmt, fmtPct } from "@/lib/format";

const RANGES = [
  { id: "1D", days: 0 },
  { id: "1M", days: 31 },
  { id: "3M", days: 92 },
  { id: "6M", days: 183 },
  { id: "YTD", days: -1 },
  { id: "1Y", days: 366 },
  { id: "5Y", days: 5 * 366 },
] as const;

type Row = { t: number; v: number; sma?: number | null };

export default function PriceChart({ daily, intraday, decimals = 2, unit = "" }: { daily: Point[]; intraday?: Point[]; decimals?: number; unit?: string }) {
  const available = RANGES.filter((r) => (r.id === "1D" ? (intraday?.length ?? 0) > 1 : true));
  const [range, setRange] = useState<(typeof RANGES)[number]["id"]>(daily.length > 200 ? "1Y" : "5Y");
  const [showSma, setShowSma] = useState(true);

  const rows: Row[] = useMemo(() => {
    if (range === "1D") return (intraday ?? []).map((p) => ({ ...p }));
    // 50-day average computed over the full series so it's valid from the window start.
    const withSma: Row[] = daily.map((p, i) => {
      if (i < 49) return { ...p, sma: null };
      let s = 0;
      for (let k = i - 49; k <= i; k++) s += daily[k].v;
      return { ...p, sma: s / 50 };
    });
    const last = daily[daily.length - 1]?.t ?? Date.now();
    const r = RANGES.find((x) => x.id === range)!;
    const from = r.days === -1 ? Date.UTC(new Date(last).getUTCFullYear(), 0, 1) : last - r.days * 86_400_000;
    return withSma.filter((p) => p.t >= from);
  }, [daily, intraday, range]);

  const first = rows[0]?.v;
  const lastV = rows[rows.length - 1]?.v;
  const change = first && lastV ? (lastV / first - 1) * 100 : null;
  const up = (change ?? 0) >= 0;
  const color = up ? "var(--up)" : "var(--down)";
  const intradayMode = range === "1D";
  const tickFmt = (t: number) => {
    const d = new Date(t);
    if (intradayMode) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return rows.length > 400 ? d.toLocaleDateString([], { month: "short", year: "2-digit" }) : d.toLocaleDateString([], { day: "numeric", month: "short" });
  };
  const hasSma = !intradayMode && rows.some((r) => r.sma != null);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg bg-surface-2 p-0.5" role="tablist" aria-label="Chart range">
          {available.map((r) => (
            <button key={r.id} role="tab" aria-selected={range === r.id} onClick={() => setRange(r.id)}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${range === r.id ? "bg-surface text-text shadow-sm" : "text-text-2 hover:text-text"}`}>
              {r.id}
            </button>
          ))}
        </div>
        {change != null && <span className={`num text-sm font-medium ${up ? "text-up" : "text-down"}`}>{up ? "▲" : "▼"} {fmtPct(change)} in range</span>}
        {hasSma && (
          <label className="ml-auto flex items-center gap-1.5 text-xs text-text-2">
            <input type="checkbox" checked={showSma} onChange={(e) => setShowSma(e.target.checked)} />
            <span className="inline-block h-0.5 w-4" style={{ background: "var(--series-2)" }} aria-hidden /> 50-day average
          </label>
        )}
      </div>
      {rows.length < 2 ? (
        <div className="grid h-72 place-items-center rounded-lg bg-surface-2 text-center text-sm text-text-2">
          Not enough history yet for this range.<br />PSX history builds up each trading day the app runs.
        </div>
      ) : (
        <div className="h-72 w-full">
          <ResponsiveContainer>
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--grid)" vertical={false} />
              <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={tickFmt}
                tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} minTickGap={40} />
              <YAxis domain={["auto", "auto"]} orientation="right" width={64} tickFormatter={(v: number) => fmt(v, v > 1000 ? 0 : decimals)}
                tick={{ fill: "var(--muted)", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                cursor={{ stroke: "var(--muted)", strokeDasharray: "3 3" }}
                contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--text)" }}
                labelFormatter={(t) => new Date(Number(t)).toLocaleString([], intradayMode ? { hour: "2-digit", minute: "2-digit" } : { dateStyle: "medium" })}
                formatter={(v, name) => [`${fmt(Number(v), decimals)} ${unit}`, name === "sma" ? "50-day avg" : "Price"]}
              />
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill="url(#fill)" isAnimationActive={false} dot={false} />
              {hasSma && showSma && <Line type="monotone" dataKey="sma" stroke="var(--series-2)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} isAnimationActive={false} connectNulls />}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
