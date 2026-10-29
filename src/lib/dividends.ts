// Cash dividend history for PSX stocks (Yahoo Finance ".KA" dividend events,
// Rs per share) and a summary of how often each company pays.
import { cached, fetchJson, mapLimit } from "./http";

export type Payout = { t: number; amount: number };

export type Frequency = "Monthly" | "Quarterly" | "Half-yearly" | "Annual" | "Irregular" | "No recent dividend" | "No dividend record";

export type DividendInfo = {
  symbol: string;
  payouts: Payout[]; // oldest first
  frequency: Frequency;
  perYear: number; // average payments per year over the last 2 years
  ttm: number; // Rs per share paid in the last 12 months
  yieldPct: number | null; // ttm / current price
  last: Payout | null;
  nextEstimate: number | null; // last payout + typical gap (estimate only)
  months: string[]; // calendar months of the latest year's payments
  byYear: { year: number; total: number; count: number }[];
};

type ChartResp = { chart: { result?: { events?: { dividends?: Record<string, { date: number; amount: number }> } }[] } };

const DAY = 86_400_000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function getPayouts(symbol: string): Promise<Payout[]> {
  return cached(`div:${symbol}`, 12 * 3600_000, async () => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.KA?range=10y&interval=1mo&events=div`;
    const data = await fetchJson<ChartResp>(url);
    return Object.values(data.chart.result?.[0]?.events?.dividends ?? {})
      .map((d) => ({ t: d.date * 1000, amount: d.amount }))
      .filter((d) => d.amount > 0)
      .sort((a, b) => a.t - b.t);
  });
}

function classify(perYear: number, lastAgeDays: number, any: boolean): Frequency {
  if (!any) return "No dividend record";
  if (lastAgeDays > 550) return "No recent dividend";
  if (perYear >= 9) return "Monthly";
  if (perYear >= 2.75) return "Quarterly";
  if (perYear >= 1.5) return "Half-yearly";
  if (perYear >= 0.75) return "Annual";
  return "Irregular";
}

export function summarizeDividends(symbol: string, payouts: Payout[], price: number | null, now = Date.now()): DividendInfo {
  const last = payouts[payouts.length - 1] ?? null;
  const recent2y = payouts.filter((p) => p.t > now - 730 * DAY);
  const perYear = recent2y.length / 2;
  const frequency = classify(perYear, last ? (now - last.t) / DAY : Infinity, payouts.length > 0);
  const ttm = payouts.filter((p) => p.t > now - 365 * DAY).reduce((a, p) => a + p.amount, 0);

  // Typical gap between recent payments, used for a rough "next expected" date.
  const recent = payouts.filter((p) => p.t > now - 3 * 365 * DAY);
  const gaps = recent.slice(1).map((p, i) => p.t - recent[i].t).sort((a, b) => a - b);
  const gap = gaps.length ? gaps[gaps.length >> 1] : null;
  let nextEstimate: number | null = null;
  if (last && gap && frequency !== "No recent dividend" && frequency !== "Irregular") {
    nextEstimate = last.t + gap;
    while (nextEstimate < now) nextEstimate += gap;
  }

  // Calendar months of the latest year's payments (payment dates drift a little year to year).
  const lastYear = payouts.filter((p) => last && p.t > last.t - 360 * DAY);
  const months = [...new Set(lastYear.map((p) => new Date(p.t).getUTCMonth()))].sort((a, b) => a - b).map((m) => MONTHS[m]);

  const years = new Map<number, { total: number; count: number }>();
  for (const p of payouts) {
    const y = new Date(p.t).getUTCFullYear();
    const e = years.get(y) ?? { total: 0, count: 0 };
    e.total += p.amount;
    e.count++;
    years.set(y, e);
  }

  return {
    symbol,
    payouts,
    frequency,
    perYear,
    ttm,
    yieldPct: price && ttm ? (ttm / price) * 100 : null,
    last,
    nextEstimate,
    months,
    byYear: [...years.entries()].map(([year, e]) => ({ year, ...e })).sort((a, b) => b.year - a.year),
  };
}

export async function getDividendInfo(symbol: string, price: number | null): Promise<DividendInfo> {
  const payouts = await getPayouts(symbol).catch(() => [] as Payout[]);
  return summarizeDividends(symbol, payouts, price);
}

/** Dividend summaries for many symbols (Yahoo is fast; cached for 12 hours). */
export async function getDividendInfos(items: { symbol: string; price: number }[]): Promise<Map<string, DividendInfo>> {
  const res = await mapLimit(items, 8, (i) => getDividendInfo(i.symbol, i.price));
  return new Map(res.map((d) => [d.symbol, d]));
}
