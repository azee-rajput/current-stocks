import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import NewsList from "@/components/NewsList";
import PriceChart from "@/components/PriceChart";
import SignalPanel from "@/components/SignalPanel";
import WatchStar from "@/components/WatchStar";
import { Change, PeriodGrid, Section } from "@/components/ui";
import { assetById, assetIntraday } from "@/lib/assets";
import { getAssetView } from "@/lib/market";
import { monthlyTable, rsi, sma } from "@/lib/analytics";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const asset = assetById(id);
  if (!asset) notFound();
  const [v, intraday] = await Promise.all([getAssetView(asset), assetIntraday(asset).catch(() => [])]);
  const r = v.returns;
  const d = asset.decimals;
  const months = monthlyTable(v.points, 13);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-sm text-text-2 capitalize">{asset.kind} · {asset.unit}</div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">{asset.name} <WatchStar id={`asset:${asset.id}`} label="Watch" /></h1>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="num text-3xl font-semibold">{fmt(r?.price, d)}</span>
            <Change value={r?.day} className="text-lg" />
          </div>
        </div>
        <AutoRefresh seconds={60} />
      </div>

      <div className="mb-6"><PeriodGrid items={[
        { label: "Today", value: r?.day },
        { label: "MTD", value: r?.mtd },
        { label: "YTD", value: r?.ytd },
        { label: "1 Year", value: r?.yoy, hint: "vs the same date last year" },
        { label: "vs same month LY", value: r?.sameMonthLY, hint: "This month's average vs the same month's average last year" },
        { label: "3 Months", value: r?.m3 },
      ]} /></div>

      <div className="mb-8 grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="card p-4"><PriceChart daily={v.points} intraday={intraday} decimals={d} unit={asset.unit} /></div>
        <SignalPanel signal={v.signal} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Key statistics">
          <div className="card grid grid-cols-2 gap-x-6 gap-y-2 p-4 text-sm">
            {[
              ["20-day average", fmt(sma(v.points, 20), d)],
              ["50-day average", fmt(sma(v.points, 50), d)],
              ["200-day average", fmt(sma(v.points, 200), d)],
              ["RSI (14)", fmt(rsi(v.points), 0)],
              ["Volatility (annualised)", v.vol != null ? `${fmt(v.vol, 1)}%` : "—"],
              ["Max drawdown (1y)", v.drawdown != null ? `${fmt(v.drawdown, 1)}%` : "—"],
              ["Stability score", v.stability != null ? `${v.stability} / 100` : "—"],
              ["52-week high", fmt(Math.max(...v.points.slice(-252).map((p) => p.v)), d)],
              ["52-week low", fmt(Math.min(...v.points.slice(-252).map((p) => p.v)), d)],
            ].map(([k, val]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-border py-1"><span className="text-text-2">{k}</span><span className="num">{val}</span></div>
            ))}
          </div>
        </Section>
        <Section title="Monthly closes" subtitle="Month-end price, change vs previous month, and vs the same month last year">
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs text-text-2">
                <tr><th className="px-3 py-2 text-left font-medium">Month</th><th className="px-3 py-2 text-right font-medium">Close</th><th className="px-3 py-2 text-right font-medium">MoM</th><th className="px-3 py-2 text-right font-medium">YoY</th></tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month} className="border-t border-border">
                    <td className="px-3 py-1.5">{new Date(m.month + "-01T00:00:00Z").toLocaleDateString([], { month: "short", year: "numeric", timeZone: "UTC" })}</td>
                    <td className="num px-3 py-1.5 text-right">{fmt(m.close, d)}</td>
                    <td className="px-3 py-1.5 text-right"><Change value={m.mom} /></td>
                    <td className="px-3 py-1.5 text-right"><Change value={m.yoy} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section title="News driving the outlook" subtitle={asset.newsInverted ? "Tone is shown for this rate: good news for the rupee is bearish for this pair." : undefined}>
        <div className="card px-4 py-2"><NewsList items={v.sentiment.headlines} limit={15} inverted={asset.newsInverted} /></div>
      </Section>
    </div>
  );
}
