// Local daily-close store for PSX symbols. PSX's history API isn't openly
// available, so every time we read a live quote we record it as that day's
// close. The store grows each day the app runs and powers PSX charts and
// MTD / same-month-last-year figures.
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

export function recordCloses(values: Record<string, number>) {
  const date = pktTradingDate();
  if (!date) return;
  const store = load();
  for (const [key, v] of Object.entries(values)) {
    if (!Number.isFinite(v) || v <= 0) continue;
    (store[key] ??= {})[date] = v;
  }
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
