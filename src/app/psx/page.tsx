import AutoRefresh from "@/components/AutoRefresh";
import PriceChart from "@/components/PriceChart";
import StockTable from "@/components/StockTable";
import { Change, Notice, PeriodGrid, Section } from "@/components/ui";
import { getIndices, getKse100Quick } from "@/lib/market";
import { getKse100History } from "@/lib/indexHistory";
import { returns } from "@/lib/analytics";
import { psxMarketStatus } from "@/lib/psx";
import { toRow } from "@/lib/rows";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";
// Many upstream fetches on a cold start; allow up to 60s on serverless hosts.
export const maxDuration = 60;

export default async function PsxPage() {
  const [indices, stocks] = await Promise.all([getIndices().catch(() => []), getKse100Quick().catch(() => [])]);
  const kse = indices.find((i) => i.code === "KSE100");
  const { points: hist, estimated } = await getKse100History();
  const r = returns(hist);
  const status = psxMarketStatus();

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Pakistan Stock Exchange</h1>
          <p className="text-sm text-text-2">{status.label} · Regular session Mon–Thu 9:30–15:30, Fri 9:15–16:30 PKT</p>
        </div>
        <AutoRefresh seconds={60} />
      </div>

      <Section title="KSE-100 Index">
        <div className="card p-4">
          <div className="mb-4 flex flex-wrap items-baseline gap-3">
            <span className="num text-3xl font-semibold">{fmt(kse?.value)}</span>
            <Change value={kse?.changePct} className="text-lg" />
            <span className="num text-text-2">{kse ? `${kse.change > 0 ? "+" : ""}${fmt(kse.change)} pts` : ""}</span>
          </div>
          <PeriodGrid items={[
            { label: "Today", value: kse?.changePct },
            { label: "MTD", value: r?.mtd },
            { label: "YTD", value: r?.ytd },
            { label: "1 Year", value: r?.yoy },
            { label: "vs same month LY", value: r?.sameMonthLY },
            { label: "3 Months", value: r?.m3 },
          ]} />
          {estimated && (
            <p className="mt-3 text-xs text-text-2">
              History is estimated: PSX&apos;s free daily files have stock prices but not index values, so past levels are rebuilt from the
              100 member stocks (weighted by index weight, dividends included) and anchored to today&apos;s live value. It uses today&apos;s
              members throughout, so periods with membership changes can differ slightly from the official index.
            </p>
          )}
          {hist.length < 30 && (
            <div className="mt-3"><Notice>
              Index history isn&apos;t available yet ({hist.length} day{hist.length === 1 ? "" : "s"}). It fills in once the PSX daily files have loaded.
            </Notice></div>
          )}
          <div className="mt-4"><PriceChart daily={hist} /></div>
        </div>
      </Section>

      <Section title="All PSX indices">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {indices.map((i) => (
            <div key={i.code} className="card p-3">
              <div className="text-xs font-medium text-text-2">{i.code}</div>
              <div className="num font-semibold">{fmt(i.value)}</div>
              <Change value={i.changePct} className="text-sm" />
            </div>
          ))}
        </div>
      </Section>

      <Section title="KSE-100 constituents" subtitle="Live prices from PSX. Click a symbol for detail, chart, news and outlook. ☆ adds it to your watchlist.">
        {stocks.length ? <StockTable rows={stocks.map((s) => toRow(s))} pageSize={100} /> : <Notice>Could not load KSE-100 constituents right now.</Notice>}
      </Section>
    </div>
  );
}
