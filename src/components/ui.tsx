// Small presentational building blocks shared by every page (server-safe).
import Link from "next/link";
import { fmtPct } from "@/lib/format";
import type { Signal } from "@/lib/analytics";
import type { Point } from "@/lib/history";

export function Change({ value, decimals = 2, className = "" }: { value: number | null | undefined; decimals?: number; className?: string }) {
  if (value == null || !Number.isFinite(value)) return <span className={`text-muted ${className}`}>—</span>;
  const cls = value > 0 ? "text-up" : value < 0 ? "text-down" : "text-flat";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "•";
  return (
    <span className={`num whitespace-nowrap ${cls} ${className}`}>
      <span aria-hidden className="mr-0.5 text-[0.7em]">{arrow}</span>
      {fmtPct(value, decimals)}
    </span>
  );
}

export function SignalBadge({ signal, compact = false }: { signal: Signal; compact?: boolean }) {
  const map = {
    rise: { label: "Likely rise", cls: "bg-up-bg text-up", icon: "↗" },
    fall: { label: "Likely fall", cls: "bg-down-bg text-down", icon: "↘" },
    sideways: { label: "Sideways", cls: "bg-surface-2 text-text-2", icon: "→" },
  }[signal.direction];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${map.cls}`}
      title={`Model score ${signal.score} · confidence ${signal.confidence}%`}>
      <span aria-hidden>{map.icon}</span>
      {map.label}
      {!compact && <span className="opacity-70">· {signal.confidence}%</span>}
    </span>
  );
}

export function ShariahBadge() {
  return (
    <span className="rounded bg-up-bg px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-up" title="Member of KMI All Share Islamic index">
      SHARIAH
    </span>
  );
}

export function Sparkline({ points, width = 120, height = 32 }: { points: Point[]; width?: number; height?: number }) {
  const s = points.slice(-90);
  if (s.length < 2) return <div style={{ width, height }} className="text-[10px] text-muted">building history…</div>;
  const vs = s.map((p) => p.v);
  const min = Math.min(...vs);
  const max = Math.max(...vs);
  const span = max - min || 1;
  const d = s.map((p, i) => `${i ? "L" : "M"}${((i / (s.length - 1)) * width).toFixed(1)},${(height - 2 - ((p.v - min) / span) * (height - 4)).toFixed(1)}`).join("");
  const up = vs[vs.length - 1] >= vs[0];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
      <path d={d} fill="none" stroke={up ? "var(--up)" : "var(--down)"} strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}

export function Section({ title, subtitle, action, children }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          {subtitle && <p className="text-sm text-text-2">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StatTile({ label, value, sub, change, href, spark }: {
  label: string; value: string; sub?: string; change?: number | null; href?: string; spark?: Point[];
}) {
  const body = (
    <div className="card h-full p-4 transition-colors hover:border-accent">
      <div className="text-xs font-medium uppercase tracking-wide text-text-2">{label}</div>
      <div className="num mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 flex items-center justify-between gap-2 text-sm">
        <span>{change !== undefined && <Change value={change} />} {sub && <span className="text-muted">{sub}</span>}</span>
        {spark && <Sparkline points={spark} width={80} height={24} />}
      </div>
    </div>
  );
  return href ? <Link href={href}>{body}</Link> : body;
}

export function PeriodGrid({ items }: { items: { label: string; value: number | null | undefined; hint?: string }[] }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {items.map((it) => (
        <div key={it.label} className="rounded-lg bg-surface-2 px-3 py-2" title={it.hint}>
          <div className="text-[11px] uppercase tracking-wide text-text-2">{it.label}</div>
          <Change value={it.value} className="text-base font-semibold" />
        </div>
      ))}
    </div>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn-text">{children}</div>;
}
