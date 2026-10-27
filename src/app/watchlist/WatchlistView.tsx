"use client";
import Link from "next/link";
import StockTable, { type StockRow } from "@/components/StockTable";
import WatchStar from "@/components/WatchStar";
import { Change, SignalBadge } from "@/components/ui";
import { useWatchlist } from "@/lib/watchlist";
import { fmt } from "@/lib/format";
import type { Signal } from "@/lib/analytics";

export type AssetRow = { id: string; name: string; unit: string; decimals: number; price?: number; day?: number | null; mtd?: number | null; ytd?: number | null; signal: Signal };

export default function WatchlistView({ stocks, assets }: { stocks: StockRow[]; assets: AssetRow[] }) {
  const { has, items } = useWatchlist();
  const watchedAssets = assets.filter((a) => has(`asset:${a.id}`));
  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 text-lg font-semibold">Commodities &amp; currencies</h2>
        {watchedAssets.length ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {watchedAssets.map((a) => (
              <Link key={a.id} href={`/asset/${a.id}`} className="card block p-4 hover:border-accent">
                <div className="flex justify-between"><span className="font-medium">{a.name}</span><WatchStar id={`asset:${a.id}`} /></div>
                <div className="num text-xl font-semibold">{fmt(a.price, a.decimals)} <span className="text-xs font-normal text-text-2">{a.unit}</span></div>
                <div className="flex gap-3 text-xs"><span>Today <Change value={a.day} /></span><span>MTD <Change value={a.mtd} /></span><span>YTD <Change value={a.ytd} /></span></div>
                <div className="mt-2"><SignalBadge signal={a.signal} /></div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="text-sm text-text-2">None yet. Click ☆ on any commodity or currency card to watch it.</p>
        )}
      </div>
      <div>
        <h2 className="mb-3 text-lg font-semibold">Stocks</h2>
        <StockTable key={items.join(",")} rows={stocks} initialFilter="watch" />
      </div>
    </div>
  );
}
