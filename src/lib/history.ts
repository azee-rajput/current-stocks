// Local daily-close store for PSX symbols. Filled from PSX's daily market
// summary files (see psxDaily.ts) and from live quotes as the app runs; it
// powers PSX charts and MTD / YTD / same-month-last-year figures.
import fs from "node:fs";
import path from "node:path";

type Store = Record<string, Record<string, number>>; // key -> { YYYY-MM-DD: close }

const FILE = path.join(process.cwd(), "data", "psx-history.json");
const g = globalThis as unknown as { __pkHist?: Store; __pkHistTimer?: NodeJS.Timeout };

function load(): Store {
  if (g.__pkHist) return g.__pkHist;
  try {
    g.__pkHist = JSON.parse(fs.readFileSync(FILE, "utf8")) as Store;
  } catch {
    g.__pkHist = {};
  }
  return g.__pkHist;
}

function scheduleSave() {
  if (g.__pkHistTimer) return;
  g.__pkHistTimer = setTimeout(() => {
    g.__pkHistTimer = undefined;
    try {
      fs.mkdirSync(path.dirname(FILE), { recursive: true });
      fs.writeFileSync(FILE, JSON.stringify(load()));
    } catch (e) {
      console.error("Could not save PSX history", e);
    }
  }, 2000);
}

/** Today's date in Pakistan time, or null on weekends (no trading). */
function pktTradingDate(now = new Date()): string | null {
  const pkt = new Date(now.getTime() + 5 * 3600_000);
  const day = pkt.getUTCDay();
  if (day === 0 || day === 6) return null;
  return pkt.toISOString().slice(0, 10);
}

/**
 * Save closes for `date` (from a PSX daily file), or for today from live quotes
 * when no date is given. A live quote equal to the last stored close is skipped:
 * before the open and on holidays PSX still shows the previous session.
 */
export function recordCloses(values: Record<string, number>, date?: string) {
  const live = !date;
  const day = date ?? pktTradingDate();
  if (!day) return;
  const store = load();
  for (const [key, v] of Object.entries(values)) {
    if (!Number.isFinite(v) || v <= 0) continue;
    const rows = (store[key] ??= {});
    if (live && !(day in rows)) {
      const lastDate = Object.keys(rows).filter((d) => d < day).sort().at(-1);
      if (lastDate && rows[lastDate] === v) continue;
    }
    rows[day] = v;
  }
  scheduleSave();
}

/** True once a full day's closes for `date` (YYYY-MM-DD) are stored under the marker key. */
export function hasDay(date: string): boolean {
  return !!load()["__days"]?.[date];
}

export function markDay(date: string) {
  (load()["__days"] ??= {})[date] = 1;
  scheduleSave();
}

export type Point = { t: number; v: number };

/** Daily series for a key, oldest first. */
export function getHistory(key: string): Point[] {
  const rows = load()[key] ?? {};
  return Object.entries(rows)
    .map(([d, v]) => ({ t: Date.parse(d + "T10:00:00Z"), v }))
    .sort((a, b) => a.t - b.t);
}
