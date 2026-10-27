import AutoRefresh from "@/components/AutoRefresh";
import { AssetCard, AssetTable } from "@/components/AssetGrid";
import { Section } from "@/components/ui";
import { ASSETS, type AssetKind } from "@/lib/assets";
import { getAssetView } from "@/lib/market";

export default async function AssetClassPage({ kind, title, intro }: { kind: AssetKind; title: string; intro: string }) {
  const views = await Promise.all(ASSETS.filter((a) => a.kind === kind).map(getAssetView));
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="max-w-3xl text-sm text-text-2">{intro}</p>
        </div>
        <AutoRefresh seconds={60} />
      </div>
      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {views.map((v) => <AssetCard key={v.asset.id} v={v} />)}
      </div>
      <Section title="Performance table" subtitle="MTD = since last month's close · YTD = since last year's close · vs same month LY = this month's average vs the same month last year">
        <AssetTable views={views} />
      </Section>
    </div>
  );
}
