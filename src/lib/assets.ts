// Catalog of non-PSX assets (commodities and PKR currency pairs) and how to
// build each one's daily series from Yahoo symbols.
import { getDaily, getIntraday, type Series } from "./yahoo";
import type { Point } from "./history";

export type AssetKind = "commodity" | "currency";

export type Asset = {
  id: string;
  name: string;
  short: string;
  kind: AssetKind;
  unit: string;
  decimals: number;
  /** Google News query used for sentiment. */
  news: string;
  /** True when good-news headlines mean this series goes DOWN (e.g. "rupee gains" => USD/PKR falls). */
  newsInverted?: boolean;
  /** Plain Yahoo symbol, or a formula over Yahoo symbols. */
  source: { yahoo: string } | { derive: (get: (s: string) => Series) => Point[]; uses: string[] };
};

const TROY_OZ_G = 31.1034768;
const TOLA_G = 11.6638038;

/** Multiply/divide two daily series, matching each point to the nearest earlier point of the other. */
function combine(a: Point[], b: Point[], f: (x: number, y: number) => number): Point[] {
  const out: Point[] = [];
  let j = 0;
  for (const p of a) {
    while (j + 1 < b.length && b[j + 1].t <= p.t + 12 * 3600_000) j++;
    if (b[j] && b[j].t <= p.t + 12 * 3600_000) out.push({ t: p.t, v: f(p.v, b[j].v) });
  }
  return out;
}

/** Value of `b` at or just before each point of `a`. */
function align(a: Point[], b: Point[]): (number | null)[] {
  let j = 0;
  return a.map((p) => {
    while (j + 1 < b.length && b[j + 1].t <= p.t + 12 * 3600_000) j++;
    return b[j] && b[j].t <= p.t + 12 * 3600_000 ? b[j].v : null;
  });
}

const median = (xs: number[]) => {
  const s = [...xs].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// Yahoo's PKR quotes intermittently flip between two feeds a few percent apart.
// The SAR and AED quotes (both currencies are pegged to USD) stay consistent, so
// they anchor USD/PKR; the direct quote and EUR/GBP crosses are averaged in only
// when they agree with that anchor.
const USD_PKR_INPUTS = ["PKR=X", "SARPKR=X", "AEDPKR=X", "EURPKR=X", "EURUSD=X", "GBPPKR=X", "GBPUSD=X"];
function usdPkr(get: (s: string) => Series): Point[] {
  const base = get("PKR=X").points;
  const at = (s: string) => align(base, get(s).points);
  const [sar, aed, eur, eurusd, gbp, gbpusd] = ["SARPKR=X", "AEDPKR=X", "EURPKR=X", "EURUSD=X", "GBPPKR=X", "GBPUSD=X"].map(at);
  return base.map((p, i) => {
    const pegged: number[] = [];
    if (sar[i]) pegged.push(sar[i]! * 3.75);
    if (aed[i]) pegged.push(aed[i]! * 3.6725);
    const others = [p.v];
    if (eur[i] && eurusd[i]) others.push(eur[i]! / eurusd[i]!);
    if (gbp[i] && gbpusd[i]) others.push(gbp[i]! / gbpusd[i]!);
    const anchor = median(pegged.length ? pegged : others);
    const agree = [...pegged, ...others].filter((x) => Math.abs(x / anchor - 1) < 0.006);
    return { t: p.t, v: agree.reduce((a, b) => a + b, 0) / agree.length };
  });
}

/** USD/PKR (cleaned) times a USD-quoted series. */
const viaUsd = (symbol: string, f: (usdPkr: number, x: number) => number) => ({
  derive: (get: (s: string) => Series) => combine(usdPkr(get), get(symbol).points, f),
  uses: [...USD_PKR_INPUTS, symbol],
});

const perTola = (usdOz: string) => viaUsd(usdOz, (pkr, usd) => (usd * pkr * TOLA_G) / TROY_OZ_G);

export const ASSETS: Asset[] = [
  { id: "gold", name: "Gold (international)", short: "Gold", kind: "commodity", unit: "USD/oz", decimals: 2, news: "gold price", source: { yahoo: "GC=F" } },
  { id: "gold-pkr", name: "Gold in PKR (per tola)", short: "Gold PKR/tola", kind: "commodity", unit: "PKR/tola", decimals: 0, news: "gold price Pakistan tola", source: perTola("GC=F") },
  { id: "silver", name: "Silver (international)", short: "Silver", kind: "commodity", unit: "USD/oz", decimals: 2, news: "silver price", source: { yahoo: "SI=F" } },
  { id: "silver-pkr", name: "Silver in PKR (per tola)", short: "Silver PKR/tola", kind: "commodity", unit: "PKR/tola", decimals: 0, news: "silver price", source: perTola("SI=F") },
  { id: "copper", name: "Copper", short: "Copper", kind: "commodity", unit: "USD/lb", decimals: 3, news: "copper price", source: { yahoo: "HG=F" } },
  { id: "platinum", name: "Platinum", short: "Platinum", kind: "commodity", unit: "USD/oz", decimals: 2, news: "platinum price", source: { yahoo: "PL=F" } },
  { id: "brent", name: "Brent crude oil", short: "Brent", kind: "commodity", unit: "USD/bbl", decimals: 2, news: "Brent crude oil price", source: { yahoo: "BZ=F" } },
  { id: "wti", name: "WTI crude oil", short: "WTI", kind: "commodity", unit: "USD/bbl", decimals: 2, news: "WTI crude oil price", source: { yahoo: "CL=F" } },
  { id: "gasoline", name: "Gasoline (RBOB)", short: "Gasoline", kind: "commodity", unit: "USD/gal", decimals: 3, news: "gasoline prices petrol", source: { yahoo: "RB=F" } },
  { id: "natgas", name: "Natural gas", short: "Nat. gas", kind: "commodity", unit: "USD/MMBtu", decimals: 3, news: "natural gas LNG price", source: { yahoo: "NG=F" } },

  { id: "usdpkr", name: "US Dollar / PKR", short: "USD/PKR", kind: "currency", unit: "PKR", decimals: 2, news: "Pakistani rupee dollar interbank", newsInverted: true, source: { derive: usdPkr, uses: USD_PKR_INPUTS } },
  { id: "eurpkr", name: "Euro / PKR", short: "EUR/PKR", kind: "currency", unit: "PKR", decimals: 2, news: "Pakistani rupee euro", newsInverted: true, source: viaUsd("EURUSD=X", (pkr, x) => pkr * x) },
  { id: "gbppkr", name: "British Pound / PKR", short: "GBP/PKR", kind: "currency", unit: "PKR", decimals: 2, news: "Pakistani rupee pound sterling", newsInverted: true, source: viaUsd("GBPUSD=X", (pkr, x) => pkr * x) },
  { id: "sarpkr", name: "Saudi Riyal / PKR", short: "SAR/PKR", kind: "currency", unit: "PKR", decimals: 2, news: "Pakistani rupee riyal remittances", newsInverted: true, source: { yahoo: "SARPKR=X" } },
  { id: "aedpkr", name: "UAE Dirham / PKR", short: "AED/PKR", kind: "currency", unit: "PKR", decimals: 2, news: "Pakistani rupee dirham", newsInverted: true, source: { yahoo: "AEDPKR=X" } },
  {
    id: "cnypkr", name: "Chinese Yuan / PKR", short: "CNY/PKR", kind: "currency", unit: "PKR", decimals: 2, news: "Pakistani rupee yuan", newsInverted: true,
    source: viaUsd("CNY=X", (pkr, cny) => pkr / cny),
  },
  { id: "jpypkr", name: "Japanese Yen / PKR", short: "JPY/PKR", kind: "currency", unit: "PKR", decimals: 4, news: "Pakistani rupee yen", newsInverted: true, source: viaUsd("JPY=X", (pkr, jpy) => pkr / jpy) },
];

export const assetById = (id: string) => ASSETS.find((a) => a.id === id);

/** Daily series for an asset (oldest first). */
export async function assetDaily(a: Asset): Promise<Point[]> {
  if ("yahoo" in a.source) return (await getDaily(a.source.yahoo)).points;
  const symbols = a.source.uses;
  const series = await Promise.all(symbols.map((s) => getDaily(s)));
  const map = new Map(symbols.map((s, i) => [s, series[i]]));
  return a.source.derive((s) => map.get(s)!);
}

/** Today's intraday series for an asset. */
export async function assetIntraday(a: Asset): Promise<Point[]> {
  if ("yahoo" in a.source) return (await getIntraday(a.source.yahoo)).points;
  const symbols = a.source.uses;
  const series = await Promise.all(symbols.map((s) => getIntraday(s)));
  const map = new Map(symbols.map((s, i) => [s, series[i]]));
  return a.source.derive((s) => map.get(s)!);
}
