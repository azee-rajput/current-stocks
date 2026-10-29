import type { DividendInfo } from "@/lib/dividends";
import { fmt } from "@/lib/format";

const date = (t: number) => new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function DividendBadge({ info }: { info: DividendInfo }) {
  const regular = ["Monthly", "Quarterly", "Half-yearly", "Annual"].includes(info.frequency);
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${regular ? "bg-up-bg text-up" : "bg-surface-2 text-text-2"}`}>
      <span aria-hidden>{regular ? "₨" : "•"}</span>
      {regular ? `Pays ${info.frequency.toLowerCase()}` : info.frequency}
    </span>
  );
}

export default function DividendPanel({ info }: { info: DividendInfo }) {
  const recent = [...info.payouts].reverse().slice(0, 10);
  const stats: [string, string, string?][] = [
    ["Payout schedule", info.frequency, info.perYear ? `${fmt(info.perYear, 1)} payments a year over the last 2 years` : undefined],
    ["Paid in last 12 months", info.ttm ? `Rs ${fmt(info.ttm)} / share` : "—"],
    ["Dividend yield", info.yieldPct ? `${fmt(info.yieldPct, 2)}%` : "—", "Last 12 months' dividends ÷ current price"],
    ["Last dividend", info.last ? `Rs ${fmt(info.last.amount)} · ${date(info.last.t)}` : "—", "Ex-dividend date"],
    ["Next expected (estimate)", info.nextEstimate ? `~${new Date(info.nextEstimate).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" })}` : "—", "Based on the usual gap between past payments, not an announcement"],
    ["Paid in (latest year)", info.months.length ? info.months.join(", ") : "—", "Calendar months of the payments in the 12 months up to the last dividend"],
  ];

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Dividends</h3>
        <DividendBadge info={info} />
      </div>
      {!info.payouts.length ? (
        <p className="text-sm text-text-2">No cash dividend record found for this company.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
          <div className="grid gap-y-1 text-sm">
            {stats.map(([k, v, hint]) => (
              <div key={k} className="flex justify-between gap-2 border-b border-border py-1" title={hint}>
                <span className="text-text-2">{k}</span>
                <span className="num text-right">{v}</span>
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-2">Recent payouts</div>
              <table className="w-full text-sm">
                <tbody>
                  {recent.map((p) => (
                    <tr key={p.t} className="border-b border-border">
                      <td className="py-1 text-text-2">{date(p.t)}</td>
                      <td className="num py-1 text-right">Rs {fmt(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium uppercase tracking-wide text-text-2">Per year</div>
              <table className="w-full text-sm">
                <tbody>
                  {info.byYear.slice(0, 8).map((y) => (
                    <tr key={y.year} className="border-b border-border">
                      <td className="py-1 text-text-2">{y.year}</td>
                      <td className="py-1 text-right text-xs text-muted">{y.count}×</td>
                      <td className="num py-1 text-right">Rs {fmt(y.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      <p className="mt-3 text-xs text-text-2">Cash dividends in Rs per share by ex-dividend date. Source: Yahoo Finance. Check PSX announcements for the official book-closure dates.</p>
    </div>
  );
}
