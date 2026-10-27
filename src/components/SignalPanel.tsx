import type { Signal } from "@/lib/analytics";
import { SignalBadge } from "./ui";

/** Explains a prediction: the overall call plus each factor's push up or down. */
export default function SignalPanel({ signal, horizon = "next 2–4 weeks" }: { signal: Signal; horizon?: string }) {
  const max = Math.max(20, ...signal.factors.map((f) => Math.abs(f.impact)));
  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Model outlook <span className="text-sm font-normal text-text-2">({horizon})</span></h3>
        <SignalBadge signal={signal} />
      </div>
      <p className="mt-1 text-sm text-text-2">
        Score <span className="num font-medium text-text">{signal.score > 0 ? "+" : ""}{signal.score}</span> on a −100…+100 scale.
        Built from trend, momentum, RSI and news tone.
      </p>
      <ul className="mt-3 space-y-2">
        {signal.factors.map((f) => (
          <li key={f.label} className="grid grid-cols-[1fr_120px] items-center gap-3 text-sm">
            <div>
              <div className="font-medium">{f.label}</div>
              <div className="text-xs text-text-2">{f.detail}</div>
            </div>
            <div className="relative h-2 rounded bg-surface-2" aria-label={`impact ${f.impact}`}>
              <div className="absolute top-0 left-1/2 h-2 w-px bg-border" />
              <div className={`absolute top-0 h-2 rounded ${f.impact > 0 ? "bg-up" : "bg-down"}`}
                style={{ left: f.impact > 0 ? "50%" : `${50 - (Math.abs(f.impact) / max) * 50}%`, width: `${(Math.abs(f.impact) / max) * 50}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-text-2">This is an automated estimate, not advice. Act on it at your own risk.</p>
    </div>
  );
}
