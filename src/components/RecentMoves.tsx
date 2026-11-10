import type { DayMove } from "@/lib/moves";
import { fmt, fmtCompact } from "@/lib/format";
import { Change } from "./ui";

const toneCls = { up: "text-up", down: "text-down", neutral: "text-text-2" } as const;
const toneIcon = { up: "▲", down: "▼", neutral: "•" } as const;

/** Last few trading days' prices, each with the likely reasons it moved. */
export default function RecentMoves({ moves }: { moves: DayMove[] }) {
  if (!moves.length) return <p className="text-sm text-text-2">Daily figures for this stock aren&apos;t available right now.</p>;
  return (
    <div className="space-y-3">
      {moves.map((m) => (
        <div key={m.date} className="card p-4">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <span className="font-semibold">{new Date(m.date + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })}</span>
            <span className="num text-lg font-semibold">Rs {fmt(m.close)}</span>
            <Change value={m.change} className="font-medium" />
            <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs text-text-2">{m.driver}</span>
          </div>
          <div className="num mt-1 flex flex-wrap gap-x-4 text-xs text-text-2">
            <span>Prev close {fmt(m.ldcp)}</span>
            <span>Open {fmt(m.open)}</span>
            <span>High {fmt(m.high)}</span>
            <span>Low {fmt(m.low)}</span>
            <span>Volume {fmtCompact(m.volume)}{m.volRatio != null && ` (${m.volRatio.toFixed(1)}× avg)`}</span>
          </div>
          <ul className="mt-3 space-y-1.5">
            {m.reasons.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className={`w-4 shrink-0 text-xs leading-5 ${toneCls[r.tone]}`} aria-hidden>{toneIcon[r.tone]}</span>
                <span><span className="font-medium">{r.label}:</span> <span className="text-text-2">{r.detail}</span></span>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <p className="text-xs text-text-2">
        Reasons are likely contributors worked out from that day&apos;s market, sector, volume, price action and news. They are not confirmed causes.
        Source: PSX daily market summary.
      </p>
    </div>
  );
}
