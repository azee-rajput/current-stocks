// Pakistan Stock Exchange data, read from the public pages on dps.psx.com.pk.
// PSX's JSON endpoints are bot-protected, so we only read the HTML pages a
// normal visitor sees, cache them, and keep request volume low.
import * as cheerio from "cheerio";
import { cached, fetchText, mapLimit } from "./http";
import { recordCloses } from "./history";

const BASE = "https://dps.psx.com.pk";

export type IndexQuote = { code: string; value: number; change: number; changePct: number };

export type Constituent = {
  symbol: string;
  name: string;
  ldcp: number; // last day close price
  price: number;
  change: number;
  changePct: number;
  weight: number; // % weight in index
  idxPoints: number;
  volume: number;
  marketCapM: number;
};

export type CompanyQuote = {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  change: number;
  changePct: number;
  open: number | null;
  high: number | null;
  low: number | null;
  volume: number | null;
  ldcp: number | null;
  low52: number | null;
  high52: number | null;
  pe: number | null;
  change1y: number | null; // %
  ytd: number | null; // %
  asOf: string;
};

const num = (s: string | undefined | null): number => {
  if (!s) return NaN;
  const n = parseFloat(s.replace(/Rs\.?/gi, "").replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};
const numOrNull = (s: string | undefined | null) => {
  const n = num(s);
  return Number.isFinite(n) ? n : null;
};

/** Headline values for every PSX index (KSE100, KMI30, ALLSHR, ...). */
export function getIndices(): Promise<IndexQuote[]> {
  return cached("psx:indices", 60_000, async () => {
    const $ = cheerio.load(await fetchText(`${BASE}/indices`));
    const seen = new Set<string>();
    const out: IndexQuote[] = [];
    $(".topIndices__item").each((_, el) => {
      const code = $(el).find(".topIndices__item__name").text().trim();
      if (!code || seen.has(code)) return;
      seen.add(code);
      const neg = $(el).find(".change__text--neg").length > 0;
      const change = Math.abs(num($(el).find(".topIndices__item__change").text()));
      const changePct = Math.abs(num($(el).find(".topIndices__item__changep").text()));
      out.push({
        code,
        value: num($(el).find(".topIndices__item__val").text()),
        change: neg ? -change : change,
        changePct: neg ? -changePct : changePct,
      });
    });
    if (!out.length) throw new Error("PSX indices page returned no data");
    recordCloses(Object.fromEntries(out.map((i) => [`IDX:${i.code}`, i.value])));
    return out;
  });
}

/** Constituent stocks of an index, e.g. KSE100, KMI30, KMIALLSHR. */
export function getConstituents(index: string): Promise<Constituent[]> {
  return cached(`psx:idx:${index}`, 60_000, async () => {
    const $ = cheerio.load(await fetchText(`${BASE}/indices/${encodeURIComponent(index)}`));
    const out: Constituent[] = [];
    $("tbody.tbl__body tr").each((_, tr) => {
      const td = $(tr).find("td");
      if (td.length < 11) return;
      const val = (i: number) => num(td.eq(i).attr("data-order") ?? td.eq(i).text());
      out.push({
        symbol: (td.eq(0).attr("data-order") ?? td.eq(0).text()).trim(),
        name: td.eq(1).text().trim(),
        ldcp: val(2),
        price: val(3),
        change: val(4),
        changePct: val(5),
        weight: num(td.eq(6).text()),
        idxPoints: val(7),
        volume: val(8),
        marketCapM: val(10) / 1e6,
      });
    });
    if (!out.length) throw new Error(`PSX index ${index} returned no constituents`);
    recordCloses(Object.fromEntries(out.map((c) => [c.symbol, c.price])));
    return out;
  });
}

/** Detailed quote for one company (sector, 52-week range, P/E, YTD, 1-year change). */
export function getCompany(symbol: string): Promise<CompanyQuote> {
  const sym = symbol.toUpperCase();
  return cached(`psx:co:${sym}`, 15 * 60_000, async () => {
    const $ = cheerio.load(await fetchText(`${BASE}/company/${encodeURIComponent(sym)}`));
    const name = $(".quote__name").clone().children().remove().end().text().trim();
    if (!name) throw new Error(`Unknown PSX symbol ${sym}`);
    const neg = $(".quote__change").hasClass("change__text--neg");
    const change = Math.abs(num($(".quote__change .change__value").text()));
    const changePct = Math.abs(num($(".quote__change .change__percent").text()));
    // The REG (regular market) panel is the first one; read its labelled stats.
    const stats = new Map<string, string>();
    $(".tabs__panel").first().find(".stats_item").each((_, el) => {
      const label = $(el).find(".stats_label").text().replace(/[*^]/g, "").trim().toUpperCase();
      if (!stats.has(label)) stats.set(label, $(el).find(".stats_value").clone().children().remove().end().text().trim());
    });
    const range = (label: string) => {
      const v = stats.get(label);
      if (!v) return [null, null] as const;
      const [lo, hi] = v.split("—").map((x) => numOrNull(x));
      return [lo ?? null, hi ?? null] as const;
    };
    const [low52, high52] = range("52-WEEK RANGE");
    const signed = (label: string) => {
      const v = stats.get(label);
      return v ? numOrNull(v) : null;
    };
    const q: CompanyQuote = {
      symbol: sym,
      name,
      sector: $(".quote__sector span").first().text().trim(),
      price: num($(".quote__close").first().text()),
      change: neg ? -change : change,
      changePct: neg ? -changePct : changePct,
      open: numOrNull(stats.get("OPEN")),
      high: numOrNull(stats.get("HIGH")),
      low: numOrNull(stats.get("LOW")),
      volume: numOrNull(stats.get("VOLUME")),
      ldcp: numOrNull(stats.get("LDCP")),
      low52,
      high52,
      pe: numOrNull(stats.get("P/E RATIO (TTM)")),
      change1y: signed("1-YEAR CHANGE"),
      ytd: signed("YTD CHANGE"),
      asOf: $(".quote__date").first().text().replace(/^\^\s*(As of\s*)?/i, "").trim(),
    };
    recordCloses({ [sym]: q.price });
    return q;
  });
}

/** Company details for many symbols, fetched slowly and cached for hours. */
export function getCompanies(symbols: string[]): Promise<CompanyQuote[]> {
  const key = `psx:cos:${[...symbols].sort().join(",")}`;
  return cached(key, 30 * 60_000, async () => {
    const res = await mapLimit(symbols, 4, (s) => getCompany(s).catch(() => null));
    return res.filter((x): x is CompanyQuote => !!x);
  });
}

/** Set of Shariah-compliant symbols (members of the KMI All Share index). */
export async function getShariahSet(): Promise<Set<string>> {
  const list = await getConstituents("KMIALLSHR").catch(() => [] as Constituent[]);
  return new Set(list.map((c) => c.symbol));
}

/** PSX regular session: Mon–Thu 09:30–15:30, Fri 09:15–16:30 (PKT, UTC+5). */
export function psxMarketStatus(now = new Date()): { open: boolean; label: string } {
  const pkt = new Date(now.getTime() + (5 * 60 + now.getTimezoneOffset()) * 60_000);
  const day = pkt.getDay();
  const mins = pkt.getHours() * 60 + pkt.getMinutes();
  if (day === 0 || day === 6) return { open: false, label: "Closed (weekend)" };
  const [o, c] = day === 5 ? [9 * 60 + 15, 16 * 60 + 30] : [9 * 60 + 30, 15 * 60 + 30];
  if (mins < o) return { open: false, label: "Pre-open" };
  if (mins > c) return { open: false, label: "Closed" };
  return { open: true, label: "Market open" };
}
