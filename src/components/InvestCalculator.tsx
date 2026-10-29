"use client";
import { useState } from "react";
import { fmt } from "@/lib/format";

type Props = {
  symbol: string;
  price: number;
  ttmDividend: number; // Rs per share paid in the last 12 months
  paymentsPerYear: number;
  frequency: string;
  change1y: number | null;
  low52: number | null;
  high52: number | null;
};

const REGULAR = ["Monthly", "Quarterly", "Half-yearly", "Annual"];
const PERIOD_NAME: Record<string, string> = { Monthly: "month", Quarterly: "quarter", "Half-yearly": "6 months", Annual: "year" };
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));

/** "How much do I get for Rs X?" — shares, dividend income and a rough future value. */
export default function InvestCalculator(p: Props) {
  // Default growth: half of last year's change, capped, so one great/bad year doesn't dominate.
  const defaultGrowth = Math.round(clamp((p.change1y ?? 10) * 0.5, -5, 12));
  // Scenario spread from the width of the 52-week range (a rough volatility proxy).
  const spread = p.low52 && p.high52 ? Math.round(clamp(((p.high52 - p.low52) / ((p.high52 + p.low52) / 2)) * 30, 5, 20)) : 10;

  const [amountText, setAmountText] = useState("100000");
  const [years, setYears] = useState(3);
  const [growth, setGrowth] = useState(defaultGrowth);
  const [filer, setFiler] = useState(true);
  const [reinvest, setReinvest] = useState(false);

  const amount = Math.max(0, Number(amountText.replace(/[^0-9.]/g, "")) || 0);
  const taxRate = filer ? 0.15 : 0.3; // withholding tax on dividends (filer / non-filer)
  const shares = p.price > 0 ? Math.floor(amount / p.price) : 0;
  const invested = shares * p.price;
  const leftover = amount - invested;
  const pays = REGULAR.includes(p.frequency) && p.ttmDividend > 0;
  const grossYear = shares * p.ttmDividend;
  const netYear = grossYear * (1 - taxRate);
  const perPayment = pays && p.paymentsPerYear >= 1 ? netYear / Math.round(p.paymentsPerYear) : null;

  const project = (g: number) => {
    let sh = shares;
    let cash = 0;
    const rows: { year: number; price: number; shares: number; value: number; dividends: number; total: number }[] = [];
    for (let y = 1; y <= years; y++) {
      const price = p.price * Math.pow(1 + g / 100, y);
      const divs = pays ? sh * p.ttmDividend * (1 - taxRate) : 0;
      if (reinvest) sh += divs / price; // fractional, for illustration
      else cash += divs;
      rows.push({ year: y, price, shares: sh, value: sh * price, dividends: cash, total: sh * price + cash });
    }
    return rows;
  };

  const base = project(growth);
  const low = project(growth - spread).at(-1);
  const high = project(growth + spread).at(-1);
  const end = base.at(-1);
  const gain = end ? end.total - invested : 0;

  return (
    <div className="card p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-semibold">Investment calculator</h3>
        <span className="text-xs text-text-2">{p.symbol} at Rs {fmt(p.price)} per share</span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-text-2">Amount to invest (Rs)</span>
          <input inputMode="numeric" value={amountText} onChange={(e) => setAmountText(e.target.value)}
            className="num w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-accent" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-text-2">Hold for</span>
          <select value={years} onChange={(e) => setYears(Number(e.target.value))}
            className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base">
            {[1, 2, 3, 5, 10].map((y) => <option key={y} value={y}>{y} year{y > 1 ? "s" : ""}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-text-2" title="Defaults to half of last year's change, capped between -5% and +12%. Change it to test your own view.">
            Assumed price growth / year
          </span>
          <div className="flex items-center gap-2">
            <input type="number" value={growth} step={1} min={-50} max={100} onChange={(e) => setGrowth(Number(e.target.value) || 0)}
              className="num w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-base outline-none focus:border-accent" />
            <span className="text-text-2">%</span>
          </div>
        </label>
        <div className="space-y-1.5 text-sm">
          <span className="block text-xs font-medium text-text-2">Options</span>
          <label className="flex items-center gap-2"><input type="checkbox" checked={filer} onChange={(e) => setFiler(e.target.checked)} /> Active tax filer (15% tax)</label>
          <label className="flex items-center gap-2"><input type="checkbox" checked={reinvest} onChange={(e) => setReinvest(e.target.checked)} disabled={!pays} /> Reinvest dividends</label>
        </div>
      </div>

      {shares === 0 ? (
        <p className="mt-4 text-sm text-text-2">Enter at least Rs {fmt(p.price)} to buy one share.</p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Tile label="Shares you can buy" value={shares.toLocaleString("en-US")} sub={`Cost Rs ${fmt(invested, 0)} · Rs ${fmt(leftover, 0)} left over`} />
            <Tile label="Dividend per year (after tax)" value={pays ? `Rs ${fmt(netYear, 0)}` : "—"}
              sub={pays ? `Gross Rs ${fmt(grossYear, 0)} · ${fmt((p.ttmDividend / p.price) * 100, 1)}% yield` : "No regular dividend"} />
            <Tile label={perPayment && PERIOD_NAME[p.frequency] ? `Per ${PERIOD_NAME[p.frequency]} (approx.)` : "Per payment"}
              value={perPayment ? `Rs ${fmt(perPayment, 0)}` : "—"} sub={pays ? `Pays ${p.frequency.toLowerCase()}` : p.frequency} />
            <Tile label={`Estimated value in ${years} yr${years > 1 ? "s" : ""}`} value={end ? `Rs ${fmt(end.total, 0)}` : "—"}
              sub={end ? `${gain >= 0 ? "+" : ""}Rs ${fmt(gain, 0)} (${fmt((gain / invested) * 100, 1)}%) incl. dividends` : ""} tone={gain >= 0 ? "up" : "down"} />
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {[
              { name: "Pessimistic", g: growth - spread, r: low },
              { name: "Base case", g: growth, r: end },
              { name: "Optimistic", g: growth + spread, r: high },
            ].map((s) => (
              <div key={s.name} className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
                <div className="flex justify-between text-xs text-text-2"><span>{s.name}</span><span className="num">{s.g > 0 ? "+" : ""}{s.g}% / yr</span></div>
                <div className={`num text-lg font-semibold ${s.r && s.r.total >= invested ? "text-up" : "text-down"}`}>Rs {fmt(s.r?.total, 0)}</div>
              </div>
            ))}
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-text-2">
                <tr className="border-b border-border">
                  <th className="py-1.5 text-left font-medium">Year</th>
                  <th className="py-1.5 text-right font-medium">Share price</th>
                  <th className="py-1.5 text-right font-medium">Shares</th>
                  <th className="py-1.5 text-right font-medium">Shares worth</th>
                  <th className="py-1.5 text-right font-medium">{reinvest ? "Dividends (reinvested)" : "Dividends received"}</th>
                  <th className="py-1.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border text-text-2">
                  <td className="py-1.5">Today</td>
                  <td className="num py-1.5 text-right">{fmt(p.price)}</td>
                  <td className="num py-1.5 text-right">{shares.toLocaleString("en-US")}</td>
                  <td className="num py-1.5 text-right">{fmt(invested, 0)}</td>
                  <td className="num py-1.5 text-right">—</td>
                  <td className="num py-1.5 text-right">{fmt(invested, 0)}</td>
                </tr>
                {base.map((r) => (
                  <tr key={r.year} className="border-b border-border">
                    <td className="py-1.5">Year {r.year}</td>
                    <td className="num py-1.5 text-right">{fmt(r.price)}</td>
                    <td className="num py-1.5 text-right">{fmt(r.shares, reinvest ? 1 : 0)}</td>
                    <td className="num py-1.5 text-right">{fmt(r.value, 0)}</td>
                    <td className="num py-1.5 text-right">{reinvest ? "in shares" : fmt(r.dividends, 0)}</td>
                    <td className="num py-1.5 text-right font-medium">{fmt(r.total, 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="mt-3 text-xs text-text-2">
        Illustration only, not a forecast or advice. It assumes dividends stay at the last 12 months&apos; level and the price grows at the rate you set.
        Brokerage commission, CDC and capital-gains tax are not included. Real returns can be much lower, including losses. Act on it at your own risk.
      </p>
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "up" | "down" }) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-text-2">{label}</div>
      <div className={`num text-xl font-semibold ${tone === "up" ? "text-up" : tone === "down" ? "text-down" : ""}`}>{value}</div>
      {sub && <div className="text-xs text-text-2">{sub}</div>}
    </div>
  );
}
