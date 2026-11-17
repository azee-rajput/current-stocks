import AutoRefresh from "@/components/AutoRefresh";
import PriceChart from "@/components/PriceChart";
import StockTable from "@/components/StockTable";
import { Change, Notice, PeriodGrid, Section } from "@/components/ui";
import { getIndices, getKse100Quick } from "@/lib/market";
import { getHistory } from "@/lib/history";
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
  const hist = getHistory("IDX:KSE100");
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
          {hist.length < 30 && (
            <div className="mt-3"><Notice>
              PSX doesn&apos;t offer free historical data, so this app records each day&apos;s close locally.
              MTD, YTD and same-month-last-year figures fill in as history builds ({hist.length} day{hist.length === 1 ? "" : "s"} recorded so far).
              Per-stock YTD and 1-year changes are available now on each stock page and in Predictions &amp; Picks.
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
