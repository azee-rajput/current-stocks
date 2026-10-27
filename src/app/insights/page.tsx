import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { AssetTable } from "@/components/AssetGrid";
import StockTable from "@/components/StockTable";
import { Change, Notice, Section, ShariahBadge, SignalBadge } from "@/components/ui";
import { getAssetViews, getKse100Full, type StockView } from "@/lib/market";
import { toRow } from "@/lib/rows";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

function PickList({ title, subtitle, rows, metric }: { title: string; subtitle: string; rows: StockView[]; metric: (s: StockView) => React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold">{title}</h3>
      <p className="mb-2 text-xs text-text-2">{subtitle}</p>
      <ol className="divide-y divide-border">
        {rows.map((s, i) => (
          <li key={s.symbol} className="flex items-center gap-2 py-1.5 text-sm">
            <span className="w-5 text-xs text-muted">{i + 1}</span>
            <Link href={`/stock/${s.symbol}`} className="font-medium hover:text-accent">{s.symbol}</Link>
            {s.shariah && <ShariahBadge />}
            <span className="ml-auto">{metric(s)}</span>
          </li>
        ))}
        {!rows.length && <li className="py-2 text-sm text-text-2">Nothing qualifies right now.</li>}
      </ol>
    </div>
  );
}

export default async function InsightsPage() {
  const [assets, stocks] = await Promise.all([getAssetViews(), getKse100Full().catch(() => [] as StockView[])]);
  const enriched = stocks.filter((s) => s.company);
  const byPick = [...enriched].sort((a, b) => b.pickScore - a.pickScore);
  const picks = byPick.filter((s) => s.signal.direction !== "fall").slice(0, 10);
  const shariahPicks = byPick.filter((s) => s.shariah && s.signal.direction !== "fall").slice(0, 10);
  const stable = [...enriched].filter((s) => s.stability != null && (s.company?.change1y ?? 0) > 0)
    .sort((a, b) => (b.stability ?? 0) - (a.stability ?? 0)).slice(0, 10);
  const weak = [...enriched].sort((a, b) => a.signal.score - b.signal.score).slice(0, 10);

  // Asset-class comparison in rupee terms: index-weighted stock returns vs gold (PKR) vs holding US dollars.
  const wsum = enriched.reduce((a, s) => a + (s.company?.change1y != null ? s.weight : 0), 0);
  const eq1y = wsum ? enriched.reduce((a, s) => a + (s.company?.change1y ?? 0) * s.weight, 0) / wsum : null;
  const wsumY = enriched.reduce((a, s) => a + (s.company?.ytd != null ? s.weight : 0), 0);
  const eqYtd = wsumY ? enriched.reduce((a, s) => a + (s.company?.ytd ?? 0) * s.weight, 0) / wsumY : null;
  const eqOutlook = wsum ? enriched.reduce((a, s) => a + s.signal.score * s.weight, 0) / enriched.reduce((a, s) => a + s.weight, 0) : null;
  const a = (id: string) => assets.find((x) => x.asset.id === id)!;
  const classes = [
    { name: "PSX equities (KSE-100 weighted)", ytd: eqYtd, y1: eq1y, outlook: eqOutlook, href: "/psx" },
    { name: "Gold (PKR per tola)", ytd: a("gold-pkr").returns?.ytd, y1: a("gold-pkr").returns?.yoy, outlook: a("gold-pkr").signal.score, href: "/asset/gold-pkr" },
    { name: "Silver (PKR per tola)", ytd: a("silver-pkr").returns?.ytd, y1: a("silver-pkr").returns?.yoy, outlook: a("silver-pkr").signal.score, href: "/asset/silver-pkr" },
    { name: "US Dollar (held in PKR)", ytd: a("usdpkr").returns?.ytd, y1: a("usdpkr").returns?.yoy, outlook: a("usdpkr").signal.score, href: "/asset/usdpkr" },
  ].sort((x, y) => (y.outlook ?? -999) - (x.outlook ?? -999));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Predictions &amp; picks</h1>
          <p className="max-w-3xl text-sm text-text-2">
            A transparent, rule-based model scores each instrument from price trend (moving averages), momentum, RSI, valuation (P/E),
            52-week position and the tone of recent news headlines. Rankings are mechanical screens, not recommendations.
          </p>
        </div>
        <AutoRefresh seconds={120} />
      </div>

      <div className="mb-6"><Notice>
        <strong>Act on the predictions at your own risk.</strong> These outputs are not personalised investment advice and the author is not a licensed advisor.
        Past performance does not guarantee future results. Diversify, and consult a SECP-licensed advisor before investing.
      </Notice></div>

      <Section title="Where is money working best? (in rupee terms)" subtitle="Compares major places Pakistanis put savings, ranked by the model's current outlook score">
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-2 text-xs text-text-2">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Asset class</th>
                <th className="px-3 py-2 text-right font-medium">YTD</th>
                <th className="px-3 py-2 text-right font-medium">1 Year</th>
                <th className="px-3 py-2 text-right font-medium">Outlook score</th>
              </tr>
            </thead>
            <tbody>
              {classes.map((c) => (
                <tr key={c.name} className="border-t border-border">
                  <td className="px-3 py-2"><Link href={c.href} className="hover:text-accent">{c.name}</Link></td>
                  <td className="px-3 py-2 text-right"><Change value={c.ytd} /></td>
                  <td className="px-3 py-2 text-right"><Change value={c.y1} /></td>
                  <td className={`num px-3 py-2 text-right font-medium ${(c.outlook ?? 0) > 0 ? "text-up" : (c.outlook ?? 0) < 0 ? "text-down" : ""}`}>
                    {c.outlook != null ? `${c.outlook > 0 ? "+" : ""}${fmt(c.outlook, 0)}` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-text-2">Bank deposits, National Savings and T-bills are not included because they have no free live price feed; compare their published rates against these returns.</p>
      </Section>

      {!enriched.length ? (
        <Notice>Could not load PSX company data right now. Try again in a minute.</Notice>
      ) : (
        <>
          <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <PickList title="Top model picks" subtitle="Best blend of outlook, stability and size" rows={picks} metric={(s) => <SignalBadge signal={s.signal} compact />} />
            <PickList title="Top Shariah-compliant picks" subtitle="Same screen, KMI All Share members only" rows={shariahPicks} metric={(s) => <SignalBadge signal={s.signal} compact />} />
            <PickList title="Most stable stocks" subtitle="Narrowest price swings, positive 1-year return" rows={stable}
              metric={(s) => <span className="num text-xs text-text-2">{s.stability}/100 · <Change value={s.company?.change1y} decimals={1} /></span>} />
            <PickList title="Weakest outlook" subtitle="Model expects pressure; caution" rows={weak} metric={(s) => <SignalBadge signal={s.signal} compact />} />
          </div>

          <Section title="Commodity & currency predictions">
            <AssetTable views={assets} />
          </Section>

          <Section title="KSE-100 screener" subtitle="Sort by outlook, stability, YTD, P/E and more. Filter by sector or Shariah compliance.">
            <StockTable rows={stocks.map((s) => toRow(s))} pageSize={100} />
          </Section>
        </>
      )}
    </div>
  );
}
