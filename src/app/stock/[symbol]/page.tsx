import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import NewsList from "@/components/NewsList";
import PriceChart from "@/components/PriceChart";
import SignalPanel from "@/components/SignalPanel";
import WatchStar from "@/components/WatchStar";
import { Change, Notice, PeriodGrid, Section, ShariahBadge } from "@/components/ui";
import { getCompany, getShariahSet } from "@/lib/psx";
import { getHistory } from "@/lib/history";
import { getNews, summarize } from "@/lib/news";
import { maxDrawdown, returns, signalFromHistory, signalFromQuote, stabilityScore, volatility } from "@/lib/analytics";
import { fmt, fmtCompact } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function StockPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  const co = await getCompany(symbol).catch(() => null);
  if (!co) notFound();
  const [shariah, news] = await Promise.all([
    getShariahSet(),
    getNews(`"${co.name.replace(/\s+(Limited|Ltd\.?)$/i, "")}" OR ${co.symbol} PSX`).catch(() => []),
  ]);
  const hist = getHistory(co.symbol);
  const r = returns(hist);
  const sent = summarize(news);
  const signal = hist.length >= 40 ? signalFromHistory(hist, sent.score, news.length) : signalFromQuote(co, sent.score, news.length);
  const vol = hist.length >= 20 ? volatility(hist) : null;
  const stability = stabilityScore({ vol, drawdown: vol != null ? maxDrawdown(hist) : null, low52: co.low52, high52: co.high52 });

  const stats: [string, string][] = [
    ["Open", fmt(co.open)],
    ["Day high", fmt(co.high)],
    ["Day low", fmt(co.low)],
    ["Previous close", fmt(co.ldcp)],
    ["Volume", fmtCompact(co.volume)],
    ["P/E (TTM)", fmt(co.pe, 2)],
    ["52-week low", fmt(co.low52)],
    ["52-week high", fmt(co.high52)],
    ["Stability score", stability != null ? `${stability} / 100` : "—"],
  ];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-text-2">{co.sector} · PSX</div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-semibold">
            {co.symbol} <span className="text-lg font-normal text-text-2">{co.name}</span>
            {shariah.has(co.symbol) && <ShariahBadge />}
            <WatchStar id={co.symbol} label="Watch" />
          </h1>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="num text-3xl font-semibold">Rs {fmt(co.price)}</span>
            <Change value={co.changePct} className="text-lg" />
            <span className="text-xs text-text-2">As of {co.asOf}</span>
          </div>
        </div>
        <AutoRefresh seconds={60} />
      </div>

      <div className="mb-6"><PeriodGrid items={[
        { label: "Today", value: co.changePct },
        { label: "MTD", value: r?.mtd, hint: "From locally recorded closes" },
        { label: "YTD", value: co.ytd, hint: "From PSX" },
        { label: "1 Year", value: co.change1y, hint: "From PSX" },
        { label: "vs same month LY", value: r?.sameMonthLY, hint: "Needs a year of locally recorded closes" },
        { label: "3 Months", value: r?.m3 },
      ]} /></div>

      {co.low52 != null && co.high52 != null && (
        <div className="card mb-6 p-4">
          <div className="mb-1 flex justify-between text-xs text-text-2"><span>52-week low {fmt(co.low52)}</span><span>52-week high {fmt(co.high52)}</span></div>
          <div className="relative h-2 rounded bg-surface-2">
            <div className="absolute -top-1 h-4 w-1 rounded bg-accent"
              style={{ left: `${Math.min(100, Math.max(0, ((co.price - co.low52) / (co.high52 - co.low52)) * 100))}%` }} title={`Current ${fmt(co.price)}`} />
          </div>
        </div>
      )}

      <div className="mb-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card p-4">
          {hist.length < 30 && <div className="mb-3"><Notice>Price history for PSX stocks is recorded locally each trading day ({hist.length} so far), so this chart grows over time.</Notice></div>}
          <PriceChart daily={hist} />
        </div>
        <SignalPanel signal={signal} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Section title="Key statistics">
          <div className="card grid gap-y-1 p-4 text-sm">
            {stats.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-border py-1"><span className="text-text-2">{k}</span><span className="num">{v}</span></div>
            ))}
          </div>
        </Section>
        <Section title="Recent news">
          <div className="card px-4 py-2"><NewsList items={news} limit={12} /></div>
        </Section>
      </div>
    </div>
  );
}
