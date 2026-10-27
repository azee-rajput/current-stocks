// Returns, indicators, stability and the rule-based rise/fall model.
import type { Point } from "./history";

export type Returns = {
  price: number;
  prev: number | null;
  day: number | null; // all returns are percentages
  mtd: number | null;
  ytd: number | null;
  yoy: number | null; // vs the same date last year
  sameMonthLY: number | null; // this month's average vs the same month's average last year
  m1: number | null;
  m3: number | null;
};

const pct = (a: number, b: number | null | undefined) => (b ? (a / b - 1) * 100 : null);

/** Last point at or before time t. */
function at(points: Point[], t: number): Point | null {
  let lo = 0;
  let hi = points.length - 1;
  let ans: Point | null = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].t <= t) {
      ans = points[mid];
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

/** Only trust a lookup if the found point is within `maxGapDays` of the target. */
function near(points: Point[], t: number, maxGapDays = 10): Point | null {
  const p = at(points, t);
  return p && t - p.t <= maxGapDays * 86_400_000 ? p : null;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export function returns(points: Point[]): Returns | null {
  if (!points.length) return null;
  const last = points[points.length - 1];
  const prev = points.length > 1 ? points[points.length - 2].v : null;
  const d = new Date(last.t);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const monthStart = Date.UTC(y, m, 1) - 1;
  const yearStart = Date.UTC(y, 0, 1) - 1;
  const lyStart = Date.UTC(y - 1, m, 1);
  const lyEnd = Date.UTC(y - 1, m + 1, 1) - 1;
  const thisMonth = avg(points.filter((p) => p.t > monthStart).map((p) => p.v));
  const lastYearMonth = avg(points.filter((p) => p.t >= lyStart && p.t <= lyEnd).map((p) => p.v));
  return {
    price: last.v,
    prev,
    day: pct(last.v, prev),
    mtd: pct(last.v, near(points, monthStart)?.v),
    ytd: pct(last.v, near(points, yearStart)?.v),
    yoy: pct(last.v, near(points, last.t - 365 * 86_400_000)?.v),
    sameMonthLY: thisMonth != null && lastYearMonth ? pct(thisMonth, lastYearMonth) : null,
    m1: pct(last.v, near(points, last.t - 30 * 86_400_000)?.v),
    m3: pct(last.v, near(points, last.t - 91 * 86_400_000)?.v),
  };
}

/** Month-end closes for the last `n` months with change vs the same month a year earlier. */
export function monthlyTable(points: Point[], n = 12) {
  const byMonth = new Map<string, number>();
  for (const p of points) byMonth.set(new Date(p.t).toISOString().slice(0, 7), p.v);
  const keys = [...byMonth.keys()].sort();
  return keys
    .slice(-n)
    .reverse()
    .map((k) => {
      const [yy, mm] = k.split("-");
      const ly = byMonth.get(`${Number(yy) - 1}-${mm}`);
      const idx = keys.indexOf(k);
      const prevM = idx > 0 ? byMonth.get(keys[idx - 1]) : undefined;
      const close = byMonth.get(k)!;
      return { month: k, close, mom: pct(close, prevM), yoy: pct(close, ly) };
    });
}

export function sma(points: Point[], n: number): number | null {
  if (points.length < n) return null;
  return avg(points.slice(-n).map((p) => p.v));
}

export function rsi(points: Point[], n = 14): number | null {
  if (points.length < n + 1) return null;
  let gain = 0;
  let loss = 0;
  const s = points.slice(-(n + 1));
  for (let i = 1; i < s.length; i++) {
    const d = s[i].v - s[i - 1].v;
    if (d > 0) gain += d;
    else loss -= d;
  }
  if (loss === 0) return 100;
  return 100 - 100 / (1 + gain / loss);
}

/** Annualised volatility (%) of daily log returns over the last `n` days. */
export function volatility(points: Point[], n = 60): number | null {
  const s = points.slice(-(n + 1));
  if (s.length < 15) return null;
  const r: number[] = [];
  for (let i = 1; i < s.length; i++) r.push(Math.log(s[i].v / s[i - 1].v));
  const m = avg(r)!;
  const variance = r.reduce((a, x) => a + (x - m) ** 2, 0) / (r.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/** Worst peak-to-trough fall (%) over the last `n` points. */
export function maxDrawdown(points: Point[], n = 252): number | null {
  const s = points.slice(-n);
  if (s.length < 15) return null;
  let peak = s[0].v;
  let worst = 0;
  for (const p of s) {
    peak = Math.max(peak, p.v);
    worst = Math.min(worst, p.v / peak - 1);
  }
  return worst * 100;
}

// ---------------------------------------------------------------------------
// Prediction model

export type Direction = "rise" | "fall" | "sideways";
export type Factor = { label: string; impact: number; detail: string };
export type Signal = { direction: Direction; score: number; confidence: number; factors: Factor[] };

const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

function finish(factors: Factor[]): Signal {
  const score = clamp(Math.round(factors.reduce((a, f) => a + f.impact, 0)), -100, 100);
  const direction: Direction = score >= 12 ? "rise" : score <= -12 ? "fall" : "sideways";
  // Confidence is deliberately capped: a simple model should never claim certainty.
  const agree = factors.filter((f) => Math.sign(f.impact) === Math.sign(score) && f.impact !== 0).length;
  const confidence = direction === "sideways" ? 35 : clamp(Math.round(40 + Math.abs(score) * 0.4 + agree * 3), 40, 80);
  return { direction, score, confidence, factors: factors.filter((f) => f.impact !== 0) };
}

const sentimentFactor = (sentiment: number, headlines: number): Factor => ({
  label: "News sentiment",
  impact: headlines ? Math.round(sentiment * 25) : 0,
  detail: headlines ? `${headlines} recent headlines, tone ${sentiment >= 0 ? "+" : ""}${sentiment.toFixed(2)}` : "No recent headlines",
});

/** Signal for anything with a daily price history (commodities, currencies, PSX once history builds up). */
export function signalFromHistory(points: Point[], sentiment: number, headlines: number): Signal {
  const f: Factor[] = [];
  const last = points[points.length - 1]?.v;
  const s20 = sma(points, 20);
  const s50 = sma(points, 50);
  const s200 = sma(points, 200);
  if (last && s50) f.push({ label: "Price vs 50-day average", impact: last > s50 ? 12 : -12, detail: `${last > s50 ? "Above" : "Below"} 50-day average (${s50.toFixed(2)})` });
  if (s50 && s200) f.push({ label: "Long-term trend", impact: s50 > s200 ? 12 : -12, detail: s50 > s200 ? "50-day above 200-day (uptrend)" : "50-day below 200-day (downtrend)" });
  if (last && s20) f.push({ label: "Short-term trend", impact: last > s20 ? 6 : -6, detail: `${last > s20 ? "Above" : "Below"} 20-day average` });
  const r = returns(points);
  if (r?.m1 != null) f.push({ label: "1-month momentum", impact: clamp(r.m1 * 2, -20, 20), detail: `${r.m1.toFixed(1)}% over 30 days` });
  const rs = rsi(points);
  if (rs != null) {
    if (rs > 70) f.push({ label: "RSI overbought", impact: -10, detail: `RSI ${rs.toFixed(0)} (> 70 often precedes pullbacks)` });
    else if (rs < 30) f.push({ label: "RSI oversold", impact: 10, detail: `RSI ${rs.toFixed(0)} (< 30 often precedes bounces)` });
  }
  f.push(sentimentFactor(sentiment, headlines));
  return finish(f);
}

/** Signal for a PSX stock from its quote page stats when little local history exists yet. */
export function signalFromQuote(q: {
  price: number; changePct: number; ytd: number | null; change1y: number | null; low52: number | null; high52: number | null; pe: number | null;
}, sentiment: number, headlines: number): Signal {
  const f: Factor[] = [];
  if (q.ytd != null) f.push({ label: "YTD momentum", impact: clamp(q.ytd * 0.5, -18, 18), detail: `${q.ytd.toFixed(1)}% year to date` });
  if (q.change1y != null) f.push({ label: "1-year trend", impact: clamp(q.change1y * 0.25, -14, 14), detail: `${q.change1y.toFixed(1)}% over 1 year` });
  if (q.low52 != null && q.high52 != null && q.high52 > q.low52) {
    const pos = (q.price - q.low52) / (q.high52 - q.low52);
    if (pos > 0.9) f.push({ label: "Near 52-week high", impact: -6, detail: "Trading in the top 10% of its yearly range; limited headroom" });
    else if (pos < 0.15) f.push({ label: "Near 52-week low", impact: 6, detail: "Trading in the bottom 15% of its yearly range; possible value" });
  }
  if (q.pe != null && q.pe > 0) {
    if (q.pe < 6) f.push({ label: "Low P/E", impact: 8, detail: `P/E ${q.pe.toFixed(1)} looks cheap vs. market` });
    else if (q.pe > 25) f.push({ label: "High P/E", impact: -8, detail: `P/E ${q.pe.toFixed(1)} looks expensive` });
  } else if (q.pe != null && q.pe < 0) f.push({ label: "Loss-making", impact: -10, detail: "Negative earnings (P/E < 0)" });
  f.push({ label: "Today's move", impact: clamp(q.changePct, -5, 5), detail: `${q.changePct.toFixed(2)}% today` });
  f.push(sentimentFactor(sentiment, headlines));
  return finish(f);
}

/**
 * Stability score 0–100 (higher = steadier). Uses volatility & drawdown when
 * there is history, otherwise the width of the 52-week range.
 */
export function stabilityScore(opts: { vol?: number | null; drawdown?: number | null; low52?: number | null; high52?: number | null }): number | null {
  if (opts.vol != null) {
    const dd = Math.abs(opts.drawdown ?? 0);
    return Math.round(clamp(100 - opts.vol * 1.6 - dd * 0.8, 0, 100));
  }
  if (opts.low52 && opts.high52) {
    const width = ((opts.high52 - opts.low52) / ((opts.high52 + opts.low52) / 2)) * 100;
    return Math.round(clamp(100 - width * 0.9, 0, 100));
  }
  return null;
}
