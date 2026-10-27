import AutoRefresh from "@/components/AutoRefresh";
import type { StockRow } from "@/components/StockTable";
import { getAssetViews, getConstituents, getKse100Quick } from "@/lib/market";
import { toRow } from "@/lib/rows";
import WatchlistView, { type AssetRow } from "./WatchlistView";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const [kse, kmi, assets] = await Promise.all([
    getKse100Quick().catch(() => []),
    getConstituents("KMIALLSHR").catch(() => []),
    getAssetViews(),
  ]);
  // Universe = KSE-100 plus every Shariah-compliant stock.
  const rows = new Map<string, StockRow>(kse.map((s) => [s.symbol, toRow(s)]));
  for (const c of kmi) if (!rows.has(c.symbol)) rows.set(c.symbol, { ...c, shariah: true });
  const assetRows: AssetRow[] = assets.map((v) => ({
    id: v.asset.id, name: v.asset.name, unit: v.asset.unit, decimals: v.asset.decimals,
    price: v.returns?.price, day: v.returns?.day, mtd: v.returns?.mtd, ytd: v.returns?.ytd, signal: v.signal,
  }));
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">My watchlist</h1>
          <p className="text-sm text-text-2">Saved in this browser only. Star ☆ any stock, commodity or currency to add it.</p>
        </div>
        <AutoRefresh seconds={60} />
      </div>
      <WatchlistView stocks={[...rows.values()]} assets={assetRows} />
    </div>
  );
}
