import Link from "next/link";
import type { AssetView } from "@/lib/market";
import { fmt } from "@/lib/format";
import { Change, SignalBadge, Sparkline } from "./ui";
import WatchStar from "./WatchStar";

export function AssetCard({ v }: { v: AssetView }) {
  const r = v.returns;
  return (
    <Link href={`/asset/${v.asset.id}`} className="card block p-4 transition-colors hover:border-accent">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{v.asset.name}</div>
          <div className="text-xs text-text-2">{v.asset.unit}</div>
        </div>
        <WatchStar id={`asset:${v.asset.id}`} />
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div>
          <div className="num text-2xl font-semibold">{fmt(r?.price, v.asset.decimals)}</div>
          <Change value={r?.day} className="text-sm" />
        </div>
        <Sparkline points={v.points} />
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1 text-xs">
        <div><div className="text-text-2">MTD</div><Change value={r?.mtd} /></div>
        <div><div className="text-text-2">YTD</div><Change value={r?.ytd} /></div>
        <div title="This month's average vs the same month last year"><div className="text-text-2">vs same mo. LY</div><Change value={r?.sameMonthLY} /></div>
      </div>
      <div className="mt-3"><SignalBadge signal={v.signal} /></div>
      {v.error && <div className="mt-2 text-xs text-down">{v.error}</div>}
    </Link>
  );
}

export function AssetTable({ views }: { views: AssetView[] }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-surface-2 text-xs text-text-2">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Asset</th>
            <th className="px-3 py-2 text-right font-medium">Price</th>
            <th className="px-3 py-2 text-right font-medium">Today</th>
            <th className="px-3 py-2 text-right font-medium">MTD</th>
            <th className="px-3 py-2 text-right font-medium">YTD</th>
            <th className="px-3 py-2 text-right font-medium">1 Year</th>
            <th className="px-3 py-2 text-right font-medium" title="This month's average vs the same month last year">vs same month LY</th>
            <th className="px-3 py-2 text-right font-medium">Outlook</th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => (
            <tr key={v.asset.id} className="border-t border-border hover:bg-surface-2">
              <td className="px-3 py-2">
                <Link href={`/asset/${v.asset.id}`} className="font-medium hover:text-accent">{v.asset.name}</Link>
                <div className="text-xs text-text-2">{v.asset.unit}</div>
              </td>
              <td className="num px-3 py-2 text-right">{fmt(v.returns?.price, v.asset.decimals)}</td>
              <td className="px-3 py-2 text-right"><Change value={v.returns?.day} /></td>
              <td className="px-3 py-2 text-right"><Change value={v.returns?.mtd} /></td>
              <td className="px-3 py-2 text-right"><Change value={v.returns?.ytd} /></td>
              <td className="px-3 py-2 text-right"><Change value={v.returns?.yoy} /></td>
              <td className="px-3 py-2 text-right"><Change value={v.returns?.sameMonthLY} /></td>
              <td className="px-3 py-2 text-right"><SignalBadge signal={v.signal} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
