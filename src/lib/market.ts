// Page-level views: combines raw data, analytics and news into ready-to-render objects.
import { ASSETS, assetDaily, type Asset } from "./assets";
import { getHistory, type Point } from "./history";
import { getCompanies, getConstituents, getIndices, getShariahSet, type CompanyQuote, type Constituent } from "./psx";
import { getNews, getSentiment, matchHeadlines, summarize, type Headline, type NewsSentiment } from "./news";
import { maxDrawdown, returns, signalFromHistory, signalFromQuote, stabilityScore, volatility, type Returns, type Signal } from "./analytics";
import { cached } from "./http";
import { getDividendInfos, type DividendInfo } from "./dividends";

export type AssetView = {
  asset: Asset;
  points: Point[];
  returns: Returns | null;
  signal: Signal;
  sentiment: NewsSentiment;
  vol: number | null;
  drawdown: number | null;
  stability: number | null;
  error?: string;
};

export async function getAssetView(asset: Asset): Promise<AssetView> {
  const [points, sentiment] = await Promise.all([
    assetDaily(asset).catch(() => [] as Point[]),
    getSentiment(asset.news, asset.newsInverted),
  ]);
  const vol = volatility(points);
  const drawdown = maxDrawdown(points);
  return {
    asset,
    points,
    returns: returns(points),
    signal: signalFromHistory(points, sentiment.score, sentiment.count),
    sentiment,
    vol,
    drawdown,
    stability: stabilityScore({ vol, drawdown }),
    error: points.length ? undefined : "Price feed unavailable right now",
  };
}

export function getAssetViews(): Promise<AssetView[]> {
  return Promise.all(ASSETS.map(getAssetView));
}

/** General Pakistan-market headlines used to find company-specific news. */
export function getMarketNews(): Promise<Headline[]> {
  return cached("news:psx-pool", 15 * 60_000, async () => {
    const lists = await Promise.all(
      ["PSX stocks", "KSE-100 index", "Pakistan Stock Exchange shares", "Pakistan company profit results"].map((q) => getNews(q, 60).catch(() => [])),
    );
    const seen = new Set<string>();
    return lists
      .flat()
      .filter((h) => (seen.has(h.title) ? false : (seen.add(h.title), true)))
      .sort((a, b) => b.published - a.published);
  });
}

export type StockView = Constituent & {
  shariah: boolean;
  company: CompanyQuote | null;
  history: Point[];
  returns: Returns | null;
  signal: Signal;
  stability: number | null;
  vol: number | null;
  news: Headline[];
  pickScore: number;
  dividend?: DividendInfo;
};

function buildStock(c: Constituent, co: CompanyQuote | null, shariah: boolean, pool: Headline[]): StockView {
  const history = getHistory(c.symbol);
  const news = matchHeadlines(pool, c.symbol, c.name);
  const sent = summarize(news);
  // Use the technical model once we have ~2 months of locally recorded closes.
  const useHistory = history.length >= 40;
  const signal = useHistory
    ? signalFromHistory(history, sent.score, news.length)
    : signalFromQuote({
        price: c.price, changePct: c.changePct, ytd: co?.ytd ?? null, change1y: co?.change1y ?? null,
        low52: co?.low52 ?? null, high52: co?.high52 ?? null, pe: co?.pe ?? null,
      }, sent.score, news.length);
  const vol = history.length >= 20 ? volatility(history) : null;
  const stability = stabilityScore({ vol, drawdown: vol != null ? maxDrawdown(history) : null, low52: co?.low52, high52: co?.high52 });
  // Investment ranking blends the model's direction with stability and size (liquidity).
  const sizeBonus = Math.min(10, Math.log10(Math.max(1, c.marketCapM)) * 2);
  const pickScore = Math.round(signal.score * 0.55 + ((stability ?? 50) - 50) * 0.35 + sizeBonus);
  return { ...c, shariah, company: co, history, returns: returns(history), signal, stability, vol, news, pickScore };
}

/** Quick view of all KSE-100 stocks (no per-company pages). */
export async function getKse100Quick(): Promise<StockView[]> {
  const [list, shariah, pool] = await Promise.all([getConstituents("KSE100"), getShariahSet(), getMarketNews().catch(() => [])]);
  const dividends = await getDividendInfos(list);
  return list.map((c) => ({ ...buildStock(c, null, shariah.has(c.symbol), pool), dividend: dividends.get(c.symbol) }));
}

/** Full view of all KSE-100 stocks, enriched with each company's quote page (slow on first load, then cached). */
export async function getKse100Full(): Promise<StockView[]> {
  const [list, shariah, pool] = await Promise.all([getConstituents("KSE100"), getShariahSet(), getMarketNews().catch(() => [])]);
  const [companies, dividends] = await Promise.all([getCompanies(list.map((c) => c.symbol)), getDividendInfos(list)]);
  const bySym = new Map(companies.map((c) => [c.symbol, c]));
  return list.map((c) => ({ ...buildStock(c, bySym.get(c.symbol) ?? null, shariah.has(c.symbol), pool), dividend: dividends.get(c.symbol) }));
}

export { getIndices, getConstituents };
