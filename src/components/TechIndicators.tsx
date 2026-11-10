import type { Point } from "@/lib/history";
import { maxDrawdown, returns, rsi, sma, volatility } from "@/lib/analytics";
import { fmt } from "@/lib/format";

type Row = { name: string; value: string; reading: string; tone: "up" | "down" | "neutral" };

/** Technical indicators with a plain-language reading of each. */
export default function TechIndicators({ points }: { points: Point[] }) {
  const price = points.at(-1)?.v;
  if (!price || points.length < 20) {
    return <p className="text-sm text-text-2">Indicators need at least 20 trading days of history ({points.length} so far).</p>;
  }
  const rows: Row[] = [];
  const rs = rsi(points);
  if (rs != null) {
    rows.push({
      name: "RSI (14)", value: fmt(rs, 0),
      reading: rs > 70 ? "Overbought: has risen fast, so a pullback is common" : rs < 30 ? "Oversold: has fallen fast, so a bounce is common" : rs >= 50 ? "Neutral to positive momentum" : "Neutral to weak momentum",
      tone: rs > 70 ? "down" : rs < 30 ? "up" : rs >= 50 ? "up" : "down",
    });
  }
  for (const n of [20, 50, 200]) {
    const s = sma(points, n);
    if (s == null) continue;
    const diff = (price / s - 1) * 100;
    rows.push({
      name: `${n}-day average`, value: fmt(s),
      reading: `Price is ${Math.abs(diff).toFixed(1)}% ${diff >= 0 ? "above" : "below"}: ${n === 20 ? "short" : n === 50 ? "medium" : "long"}-term trend is ${diff >= 0 ? "up" : "down"}`,
      tone: diff >= 0 ? "up" : "down",
    });
  }
  const s50 = sma(points, 50);
  const s200 = sma(points, 200);
  if (s50 && s200) {
    rows.push({ name: "50 vs 200-day", value: s50 > s200 ? "Golden cross zone" : "Death cross zone",
      reading: s50 > s200 ? "Medium-term average is above long-term, a bullish structure" : "Medium-term average is below long-term, a bearish structure", tone: s50 > s200 ? "up" : "down" });
  }
  const r = returns(points);
  if (r?.m1 != null) rows.push({ name: "1-month momentum", value: `${r.m1 > 0 ? "+" : ""}${fmt(r.m1, 1)}%`, reading: r.m1 >= 0 ? "Gaining over the last month" : "Losing over the last month", tone: r.m1 >= 0 ? "up" : "down" });
  if (r?.m3 != null) rows.push({ name: "3-month momentum", value: `${r.m3 > 0 ? "+" : ""}${fmt(r.m3, 1)}%`, reading: r.m3 >= 0 ? "Gaining over the last quarter" : "Losing over the last quarter", tone: r.m3 >= 0 ? "up" : "down" });
  const vol = volatility(points);
  if (vol != null) rows.push({ name: "Volatility (annualised)", value: `${fmt(vol, 1)}%`, reading: vol < 25 ? "Relatively steady" : vol < 45 ? "Moderate swings" : "Large swings: higher risk", tone: "neutral" });
  const dd = maxDrawdown(points);
  if (dd != null) rows.push({ name: "Max drawdown (1y)", value: `${fmt(dd, 1)}%`, reading: "Worst peak-to-trough fall in the past year", tone: "neutral" });

  const cls = { up: "text-up", down: "text-down", neutral: "text-text-2" };
  return (
    <div className="card divide-y divide-border">
      {rows.map((x) => (
        <div key={x.name} className="grid grid-cols-[minmax(0,10rem)_6rem_1fr] items-center gap-3 px-4 py-2 text-sm">
          <span className="text-text-2">{x.name}</span>
          <span className="num font-medium">{x.value}</span>
          <span className={cls[x.tone]}>{x.reading}</span>
        </div>
      ))}
    </div>
  );
}
