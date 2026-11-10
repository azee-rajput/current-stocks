// Explains a stock's daily price moves from observable facts: ex-dividend
// adjustments, the market and sector move that day, volume, intraday action
// and same-day news. These are likely contributors, not proven causes.
import type { Day, DayRow } from "./psxDaily";
import type { Payout } from "./dividends";
import { matchHeadlines, type Headline } from "./news";
import type { Point } from "./history";

export type Tone = "up" | "down" | "neutral";
export type Reason = { label: string; detail: string; tone: Tone };
export type DayMove = DayRow & { market: number | null; sector: number | null; sectorCount: number; volRatio: number | null; driver: string; reasons: Reason[] };

const DAY = 86_400_000;
const toneOf = (x: number, eps = 0.05): Tone => (x > eps ? "up" : x < -eps ? "down" : "neutral");
const pct = (x: number) => `${x > 0 ? "+" : ""}${x.toFixed(2)}%`;

/** Value-weighted average % change of the given rows. */
function weightedChange(rows: DayRow[], weight: (r: DayRow) => number): number | null {
  let w = 0;
  let s = 0;
  for (const r of rows) {
    const k = weight(r);
    if (k > 0 && r.ldcp > 0) {
      w += k;
      s += k * r.change;
    }
  }
  return w ? s / w : null;
}

/** KSE-100 % change for a date: from recorded index closes when available, else a weighted average of its members. */
function marketChange(day: Day, kseWeights: Map<string, number>, indexHist: Point[]): number | null {
  const t = Date.parse(day.date + "T10:00:00Z");
  const i = indexHist.findIndex((p) => p.t === t);
  if (i > 0 && t - indexHist[i - 1].t < 5 * DAY) return (indexHist[i].v / indexHist[i - 1].v - 1) * 100;
  return weightedChange([...day.rows.values()].filter((r) => kseWeights.has(r.symbol)), (r) => kseWeights.get(r.symbol)!);
}

export function explainMoves(opts: {
  symbol: string;
  days: Day[]; // newest first; the extra days beyond `show` are used for the volume baseline
  show?: number;
  kseWeights: Map<string, number>;
  kseHistory: Point[];
  sectorName?: string;
  payouts: Payout[];
  news: Headline[];
}): DayMove[] {
  const { symbol, days, kseWeights, kseHistory, payouts, news } = opts;
  const show = opts.show ?? 3;
  const out: DayMove[] = [];

  days.slice(0, show).forEach((day, idx) => {
    const r = day.rows.get(symbol);
    if (!r) return;
    const reasons: Reason[] = [];
    const change = r.change;

    // 1. Entitlements: on ex-dates the price drops mechanically by the payout.
    // PSX keeps the XD mark on the name for several days, so only the first
    // marked day (the previous session wasn't marked) is the ex-date.
    const prev = days[idx + 1]?.rows.get(symbol);
    const exDay = (flag: string) => r.exFlags.includes(flag) && (prev ? !prev.exFlags.includes(flag) : true);
    let adjusted = change;
    if (exDay("XD")) {
      const t = Date.parse(r.date + "T00:00:00Z");
      const div = payouts.find((p) => Math.abs(p.t - t) < 6 * DAY);
      if (div && r.ldcp > 0) {
        adjusted = ((r.close + div.amount) / r.ldcp - 1) * 100;
        reasons.push({
          label: "Ex-dividend day",
          detail: `Rs ${div.amount.toFixed(2)}/share dividend went to existing holders, so the price is cut by about that much (${((div.amount / r.ldcp) * 100).toFixed(1)}%). Adding it back, the stock moved ${pct(adjusted)}.`,
          tone: "neutral",
        });
      } else {
        reasons.push({ label: "Ex-dividend day", detail: "Buyers from today don't get the announced dividend, so the price adjusts down by roughly the dividend amount.", tone: "neutral" });
      }
    }
    if (exDay("XB")) reasons.push({ label: "Ex-bonus day", detail: "Bonus shares were issued; the price adjusts down for the larger share count.", tone: "neutral" });
    if (exDay("XR")) reasons.push({ label: "Ex-rights day", detail: "Rights entitlement detached; the price adjusts for the new discounted shares.", tone: "neutral" });

    // 2. Market and sector context.
    const market = marketChange(day, kseWeights, kseHistory);
    if (market != null) {
      reasons.push({ label: "Market", detail: `KSE-100 ${market >= 0 ? "rose" : "fell"} ${pct(market)}${Math.abs(market) >= 1 ? ` (a broad ${market > 0 ? "rally" : "sell-off"})` : ""}.`, tone: toneOf(market) });
    }
    const peers = [...day.rows.values()].filter((p) => p.sectorCode === r.sectorCode && p.symbol !== symbol && p.volume > 0);
    const sector = weightedChange(peers, (p) => p.close * p.volume);
    if (sector != null && peers.length >= 2) {
      reasons.push({ label: "Sector", detail: `${opts.sectorName ? titleCase(opts.sectorName) : "Sector"} peers (${peers.length} stocks, weighted by value traded) averaged ${pct(sector)}.`, tone: toneOf(sector) });
    }

    // 3. Stock-specific part of the move.
    const benchmark = sector ?? market;
    if (benchmark != null) {
      const excess = adjusted - benchmark;
      if (Math.abs(excess) >= 1) {
        reasons.push({
          label: excess > 0 ? "Outperformed" : "Underperformed",
          detail: `${excess > 0 ? "Beat" : "Lagged"} its ${sector != null ? "sector" : "the market"} by ${Math.abs(excess).toFixed(1)} points, so something specific to ${symbol} drove ${excess > 0 ? "buying" : "selling"}.`,
          tone: toneOf(excess),
        });
      }
    }

    // 4. Volume vs the prior days.
    const prior = days.slice(idx + 1).map((d) => d.rows.get(symbol)?.volume ?? 0).filter((v) => v > 0);
    const avgVol = prior.length >= 3 ? prior.reduce((a, b) => a + b, 0) / prior.length : null;
    const volRatio = avgVol ? r.volume / avgVol : null;
    if (volRatio != null) {
      if (volRatio >= 2) reasons.push({ label: "Heavy volume", detail: `${volRatio.toFixed(1)}× its recent average. Strong participation makes the move more meaningful.`, tone: toneOf(change) });
      else if (volRatio <= 0.5) reasons.push({ label: "Light volume", detail: `Only ${volRatio.toFixed(1)}× its recent average. A move on thin trading is less reliable.`, tone: "neutral" });
    }

    // 5. Intraday action.
    if (r.ldcp > 0 && r.open > 0) {
      const gap = (r.open / r.ldcp - 1) * 100;
      if (Math.abs(gap) >= 2) reasons.push({ label: gap > 0 ? "Gap up" : "Gap down", detail: `Opened ${pct(gap)} from the previous close, usually a reaction to overnight news or results.`, tone: toneOf(gap) });
    }
    if (r.high > r.low) {
      const pos = (r.close - r.low) / (r.high - r.low);
      if (pos >= 0.8) reasons.push({ label: "Closed near the high", detail: "Buyers stayed in control into the close.", tone: "up" });
      else if (pos <= 0.2) reasons.push({ label: "Closed near the low", detail: "Selling pressure persisted into the close.", tone: "down" });
    }
    if (Math.abs(change) >= 9.8) reasons.push({ label: change > 0 ? "Upper circuit" : "Lower circuit", detail: "Hit PSX's ±10% daily price limit.", tone: toneOf(change) });

    // 6. Same-day news (Pakistan time): company headlines first, then one market headline.
    const dayNews = news.filter((h) => new Date(h.published + 5 * 3600_000).toISOString().slice(0, 10) === r.date);
    // Drop evergreen pages (profiles, quote/chart pages) that news search also returns.
    const evergreen = /profile|technical analysis|fundamentals|stock analysis|live chart|stock price|share price today|company announcements/i;
    const companyNews = matchHeadlines(dayNews, symbol, r.name).filter((h) => !evergreen.test(h.title));
    for (const h of companyNews.slice(0, 3)) {
      reasons.push({ label: "Company news", detail: `${h.title} (${h.source})`, tone: toneOf(h.score) });
    }
    // Morning headlines often recap the previous session, so skip any whose tone contradicts the day's market move.
    const marketNews = dayNews.find((h) => !companyNews.includes(h) && /PSX|KSE|stock/i.test(h.title)
      && (market == null || h.score === 0 || Math.sign(h.score) === Math.sign(market)));
    if (marketNews) reasons.push({ label: "Market news", detail: `${marketNews.title} (${marketNews.source})`, tone: toneOf(marketNews.score) });

    out.push({ ...r, market, sector, sectorCount: peers.length, volRatio, driver: mainDriver(change, adjusted, exDay("XD"), market, sector, companyNews.length), reasons });
  });
  return out;
}

function mainDriver(change: number, adjusted: number, xd: boolean, market: number | null, sector: number | null, newsCount: number): string {
  if (Math.abs(change) < 0.3) return "Little changed";
  if (xd && Math.abs(adjusted) < Math.abs(change) / 2) return "Mostly the ex-dividend adjustment";
  const same = (x: number | null) => x != null && Math.sign(x) === Math.sign(adjusted) && Math.abs(x) >= Math.abs(adjusted) * 0.6;
  if (same(sector) && same(market)) return "Moved with the market and its sector";
  if (same(sector)) return "Moved with its sector";
  if (same(market)) return "Moved with the market";
  return newsCount ? "Stock-specific move (see company news)" : "Stock-specific move";
}

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\b(And|Of)\b/g, (m) => m.toLowerCase());
