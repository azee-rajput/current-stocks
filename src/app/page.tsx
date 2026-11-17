import Link from "next/link";
import AutoRefresh from "@/components/AutoRefresh";
import { AssetCard } from "@/components/AssetGrid";
import NewsList from "@/components/NewsList";
import { Change, Notice, Section, SignalBadge, StatTile } from "@/components/ui";
import { getAssetViews, getIndices, getKse100Quick, getMarketNews } from "@/lib/market";
import { psxMarketStatus } from "@/lib/psx";
import { getHistory } from "@/lib/history";
import { getKse100History } from "@/lib/indexHistory";
import { fmt, fmtCompact } from "@/lib/format";

export const dynamic = "force-dynamic";
// Many upstream fetches on a cold start; allow up to 60s on serverless hosts.
export const maxDuration = 60;

export default async function Home() {
  const [indices, stocks, assets, news, kseHist] = await Promise.all([
    getIndices().catch(() => []),
    getKse100Quick().catch(() => []),
    getAssetViews(),
    getMarketNews().catch(() => []),
    getKse100History().catch(() => ({ points: [], estimated: false })),
  ]);
  const status = psxMarketStatus();
  const idx = (c: string) => indices.find((i) => i.code === c);
  const asset = (id: string) => assets.find((a) => a.asset.id === id)!;
  const gainers = [...stocks].sort((a, b) => b.changePct - a.changePct).slice(0, 5);
  const losers = [...stocks].sort((a, b) => a.changePct - b.changePct).slice(0, 5);
  const active = [...stocks].sort((a, b) => b.volume - a.volume).slice(0, 5);
  const advancing = stocks.filter((s) => s.changePct > 0).length;
  const declining = stocks.filter((s) => s.changePct < 0).length;

  const tiles = [
    { label: "KSE-100", code: "KSE100", href: "/psx" },
    { label: "KMI-30 (Shariah)", code: "KMI30", href: "/shariah" },
    { label: "All Share", code: "ALLSHR", href: "/psx" },
  ].map((t) => ({ ...t, i: idx(t.code) }));

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pakistan markets at a glance</h1>
          <p className="text-sm text-text-2">
            PSX: <span className={status.open ? "text-up" : "text-text-2"}>{status.label}</span> · Commodities &amp; FX trade around the clock
          </p>
        </div>
        <AutoRefresh seconds={60} />
      </div>

      {!indices.length && <div className="mb-4"><Notice>PSX data is temporarily unavailable. Showing what we could load.</Notice></div>}

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={fmt(t.i?.value)} change={t.i?.changePct} href={t.href}
            sub={t.i ? `${t.i.change > 0 ? "+" : ""}${fmt(t.i.change)} pts` : undefined}
            spark={t.code === "KSE100" ? kseHist.points.slice(-60) : getHistory(`IDX:${t.code}`)} />
        ))}
        {(["gold-pkr", "usdpkr", "brent"] as const).map((id) => {
          const v = asset(id);
          return <StatTile key={id} label={v.asset.short} value={fmt(v.returns?.price, v.asset.decimals)} change={v.returns?.day}
            sub={v.asset.unit} href={`/asset/${id}`} spark={v.points.slice(-60)} />;
        })}
      </div>

      <div className="mb-8 grid gap-4 lg:grid-cols-3">
        {[{ title: "Top gainers", rows: gainers }, { title: "Top losers", rows: losers }, { title: "Most active", rows: active }].map((b) => (
          <div key={b.title} className="card p-4">
            <h3 className="mb-2 font-semibold">{b.title} <span className="text-xs font-normal text-text-2">KSE-100</span></h3>
            <ul className="divide-y divide-border">
              {b.rows.map((s) => (
                <li key={s.symbol} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                  <Link href={`/stock/${s.symbol}`} className="font-medium hover:text-accent">{s.symbol}</Link>
                  <span className="num ml-auto text-text-2">{b.title === "Most active" ? fmtCompact(s.volume) : fmt(s.price)}</span>
                  <Change value={s.changePct} className="w-20 text-right" />
                </li>
              ))}
              {!b.rows.length && <li className="py-2 text-sm text-text-2">No data</li>}
            </ul>
          </div>
        ))}
      </div>

      {stocks.length > 0 && (
        <p className="-mt-4 mb-8 text-sm text-text-2">
          Market breadth: <span className="text-up">{advancing} advancing</span> · <span className="text-down">{declining} declining</span> · {stocks.length - advancing - declining} unchanged
        </p>
      )}

      <Section title="Commodities" subtitle="International prices with Pakistani rupee parity" action={<Link className="text-sm text-accent" href="/commodities">All commodities →</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["gold", "gold-pkr", "silver", "copper", "brent", "wti", "gasoline", "natgas"].map((id) => <AssetCard key={id} v={asset(id)} />)}
        </div>
      </Section>

      <Section title="Currencies (PKR)" subtitle="Rupees per unit of foreign currency. ▲ means the rupee weakened" action={<Link className="text-sm text-accent" href="/currencies">All currencies →</Link>}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {["usdpkr", "eurpkr", "gbppkr", "sarpkr"].map((id) => <AssetCard key={id} v={asset(id)} />)}
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Section title="Market news" subtitle="Latest Pakistan market headlines, scored for tone">
          <div className="card px-4 py-2"><NewsList items={news} limit={12} /></div>
        </Section>
        <Section title="Outlook snapshot" action={<Link className="text-sm text-accent" href="/insights">Full predictions →</Link>}>
          <div className="card divide-y divide-border">
            {assets.map((v) => (
              <Link key={v.asset.id} href={`/asset/${v.asset.id}`} className="flex items-center justify-between gap-2 px-4 py-2 text-sm hover:bg-surface-2">
                <span>{v.asset.short}</span>
                <SignalBadge signal={v.signal} compact />
              </Link>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}
