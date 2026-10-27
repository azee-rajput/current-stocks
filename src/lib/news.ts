// Free news from Google News RSS, scored with a small finance-word lexicon.
import { XMLParser } from "fast-xml-parser";
import { cached, fetchText } from "./http";

export type Headline = { title: string; link: string; source: string; published: number; score: number };
export type NewsSentiment = { score: number; count: number; headlines: Headline[] }; // score in [-1, 1]

const POS = [
  "surge", "surges", "rally", "rallies", "gain", "gains", "rise", "rises", "rising", "jump", "jumps", "soar", "soars",
  "bullish", "profit", "profits", "growth", "upgrade", "upgraded", "beat", "beats",
  "boost", "boosts", "strong", "stronger", "recover", "recovers", "recovery", "inflow", "inflows", "approves", "approved",
  "rebound", "rebounds", "climb", "climbs", "higher", "up", "positive", "optimism", "upbeat", "high", "highs", "advance",
  "advances", "firm", "firms", "appreciates", "appreciation", "strengthens", "dividend", "expansion", "buying", "outperform",
];
const NEG = [
  "fall", "falls", "falling", "drop", "drops", "plunge", "plunges", "slump", "slumps", "decline", "declines", "loss",
  "losses", "bearish", "crash", "crashes", "slide", "slides", "tumble", "tumbles", "weak", "weaker", "weakens", "cut",
  "cuts", "downgrade", "downgraded", "deficit", "sell-off", "selloff", "lower", "down", "fears", "fear", "risk", "war",
  "sanctions", "negative", "pessimism", "low", "lows", "slips", "slip", "dips", "dip", "depreciates", "depreciation",
  "pressure", "volatile", "uncertainty", "default", "outflow", "outflows", "selling", "slowdown", "recession", "shortage",
];
const posSet = new Set(POS);
const negSet = new Set(NEG);

function scoreText(text: string): number {
  const t = text.toLowerCase();
  let p = 0;
  let n = 0;
  if (/record high|all-time high/.test(t)) p++;
  for (const w of t.split(/[^a-z\-]+/)) {
    if (posSet.has(w)) p++;
    else if (negSet.has(w)) n++;
  }
  return p + n === 0 ? 0 : (p - n) / (p + n);
}

const parser = new XMLParser({ ignoreAttributes: false });

type RssItem = { title?: string; link?: string; pubDate?: string; source?: string | { "#text"?: string } };

export function getNews(query: string, limit = 20): Promise<Headline[]> {
  return cached(`news:${query}`, 15 * 60_000, async () => {
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query + " when:14d")}&hl=en-PK&gl=PK&ceid=PK:en`;
    const xml = parser.parse(await fetchText(url));
    const raw = xml?.rss?.channel?.item;
    const items: RssItem[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
    return items
      .map((it) => {
        const source = typeof it.source === "string" ? it.source : it.source?.["#text"] ?? "";
        // Google appends " - Source" to titles; strip it before scoring.
        const title = String(it.title ?? "").replace(new RegExp(`\\s+-\\s+${escapeRe(source)}$`), "");
        return { title, link: String(it.link ?? ""), source, published: Date.parse(it.pubDate ?? "") || 0, score: scoreText(title) };
      })
      .sort((a, b) => b.published - a.published)
      .slice(0, limit);
  });
}

function escapeRe(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Recency-weighted average sentiment; inverted for quotes where good news pushes the price down. */
export function summarize(headlines: Headline[], inverted = false): NewsSentiment {
  const now = Date.now();
  let w = 0;
  let s = 0;
  for (const h of headlines) {
    if (h.score === 0) continue;
    const ageDays = Math.max(0, (now - h.published) / 86_400_000);
    const weight = Math.exp(-ageDays / 4); // half-weight after ~3 days
    w += weight;
    s += weight * h.score;
  }
  const score = w ? s / w : 0;
  return { score: inverted ? -score : score, count: headlines.length, headlines };
}

export async function getSentiment(query: string, inverted = false): Promise<NewsSentiment> {
  try {
    return summarize(await getNews(query), inverted);
  } catch {
    return { score: 0, count: 0, headlines: [] };
  }
}

/** Headlines from a pool that mention a company (by symbol or a distinctive name word). */
export function matchHeadlines(pool: Headline[], symbol: string, name: string): Headline[] {
  const generic = new Set(["limited", "ltd", "company", "pakistan", "bank", "the", "of", "and", "corporation", "industries", "fund", "power", "oil", "gas", "cement", "mills", "textile", "sugar"]);
  const word = name.split(/\s+/).find((w) => w.length > 3 && !generic.has(w.toLowerCase()));
  const re = new RegExp(`\\b(${escapeRe(symbol)}${word ? "|" + escapeRe(word) : ""})\\b`, "i");
  return pool.filter((h) => re.test(h.title));
}
