import type { StockRow } from "@/components/StockTable";
import type { StockView } from "./market";

/** Trim a StockView to the plain fields the client table needs. */
export function toRow(s: StockView, withSignal = true): StockRow {
  return {
    symbol: s.symbol,
    name: s.name,
    price: s.price,
    changePct: s.changePct,
    volume: s.volume,
    marketCapM: s.marketCapM,
    weight: s.weight,
    shariah: s.shariah,
    sector: s.company?.sector,
    threeDay: s.threeDay,
    ytd: s.company?.ytd ?? s.returns?.ytd,
    change1y: s.company?.change1y ?? s.returns?.yoy,
    pe: s.company?.pe,
    // Outlook and stability need either the company page or enough daily history.
    stability: s.company || s.history.length >= 40 ? s.stability : undefined,
    signal: withSignal && (s.company || s.history.length >= 40) ? s.signal : undefined,
    divFrequency: s.dividend?.frequency,
    divYield: s.dividend?.yieldPct,
  };
}
