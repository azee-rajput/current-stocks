// Estimated KSE-100 history, rebuilt from its member stocks' daily closes.
// PSX's daily files carry stock prices but not index values, and a serverless
// host can't accumulate live index readings, so we chain the index backwards
// from today's live value using each day's market-cap-weighted member return
// (dividends included on ex-dates, as KSE-100 is a total-return index).
import { cached } from "./http";
import { getHistory, type Point } from "./history";
import { getConstituents, getIndices } from "./psx";
import { getDividendInfos } from "./dividends";

export type IndexSeries = { points: Point[]; estimated: boolean };

const DAY = 86_400_000;

export function estimateKse100(): Promise<Point[]> {
  return cached("idx:est:KSE100", 10 * 60_000, async () => {
    const [members, indices] = await Promise.all([getConstituents("KSE100"), getIndices()]);
    const live = indices.find((i) => i.code === "KSE100")?.value;
    if (!live) return [];
    const divs = await getDividendInfos(members);

    const series = members.map((m) => {
      const pts = getHistory(m.symbol);
      return { m, closes: new Map(pts.map((p) => [p.t, p.v])), payouts: divs.get(m.symbol)?.payouts ?? [] };
    });
    // Trading days = dates on which most members have a close.
    const counts = new Map<number, number>();
    for (const s of series) for (const t of s.closes.keys()) counts.set(t, (counts.get(t) ?? 0) + 1);
    const days = [...counts.entries()].filter(([, c]) => c >= members.length * 0.6).map(([t]) => t).sort((a, b) => a - b);
    if (days.length < 2) return [];

    // Daily index return: members weighted by today's index weight, scaled back
    // by price (shares assumed constant, so market cap moves with price).
    const ret = new Map<number, number>();
    for (let i = 1; i < days.length; i++) {
      const [t0, t1] = [days[i - 1], days[i]];
      let w = 0;
      let s = 0;
      for (const { m, closes, payouts } of series) {
        const c0 = closes.get(t0);
        const c1 = closes.get(t1);
        if (!c0 || !c1 || !m.price) continue;
        // Dividend whose ex-date (Yahoo's date) falls after the previous session and by this one.
        const div = payouts.filter((p) => p.t > t0 - DAY / 2 && p.t <= t1 + DAY / 2).reduce((a, p) => a + p.amount, 0);
        const weight = m.weight * (c0 / m.price);
        w += weight;
        s += weight * ((c1 + div) / c0 - 1);
      }
      if (w) ret.set(t1, s / w);
    }

    // Anchor the latest session to the live value and chain backwards.
    const out: Point[] = [{ t: days[days.length - 1], v: live }];
    for (let i = days.length - 1; i > 0; i--) {
      const r = ret.get(days[i]) ?? 0;
      out.push({ t: days[i - 1], v: out[out.length - 1].v / (1 + r) });
    }
    return out.reverse();
  });
}

/** KSE-100 daily history: locally recorded index closes when there are enough, otherwise the estimate. */
export async function getKse100History(): Promise<IndexSeries> {
  const recorded = getHistory("IDX:KSE100");
  if (recorded.length >= 120) return { points: recorded, estimated: false };
  const est = await estimateKse100().catch(() => [] as Point[]);
  return est.length > recorded.length ? { points: est, estimated: true } : { points: recorded, estimated: false };
}
