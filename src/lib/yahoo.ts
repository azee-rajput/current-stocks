// Commodity and currency prices from Yahoo Finance's public chart endpoint.
import { cached, fetchJson } from "./http";
import type { Point } from "./history";

type ChartResp = {
  chart: {
    result?: {
      meta: { regularMarketPrice: number; chartPreviousClose?: number; previousClose?: number; regularMarketTime: number; currency?: string };
      timestamp?: number[];
      indicators: { quote: { close: (number | null)[] }[] };
    }[];
    error?: { description?: string } | null;
  };
};

export type Series = { symbol: string; price: number; prevClose: number | null; time: number; points: Point[] };

async function load(symbol: string, range: string, interval: string): Promise<Series> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;
  const data = await fetchJson<ChartResp>(url);
  const r = data.chart.result?.[0];
  if (!r) throw new Error(data.chart.error?.description ?? `No data for ${symbol}`);
  const closes = r.indicators.quote[0]?.close ?? [];
  const points: Point[] = [];
  (r.timestamp ?? []).forEach((ts, i) => {
    const v = closes[i];
    if (v != null && Number.isFinite(v)) points.push({ t: ts * 1000, v });
  });
  // Make the latest live price the final point so charts and stats agree.
  const price = r.meta.regularMarketPrice;
  const time = r.meta.regularMarketTime * 1000;
  if (points.length && price) {
    const last = points[points.length - 1];
    if (time - last.t < 20 * 3600_000) last.v = price;
    else points.push({ t: time, v: price });
  }
  return { symbol, price, prevClose: r.meta.previousClose ?? r.meta.chartPreviousClose ?? null, time, points };
}

/** ~6 years of daily closes (enough for YTD, YoY and 200-day averages). */
export function getDaily(symbol: string): Promise<Series> {
  return cached(`yf:d:${symbol}`, 60_000, () => load(symbol, "6y", "1d"));
}

/** Today's intraday series at 5-minute resolution. */
export function getIntraday(symbol: string): Promise<Series> {
  return cached(`yf:i:${symbol}`, 60_000, () => load(symbol, "1d", "5m"));
}
