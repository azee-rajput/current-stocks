// PSX daily market summary files (dps.psx.com.pk/download/mkt_summary/<date>.Z):
// a ZIP holding one pipe-delimited row per listed stock with that day's
// open/high/low/close, volume and previous close. Used for the last few days'
// prices, daily move explanations, and a one-time backfill of price history.
import zlib from "node:zlib";
import { cached } from "./http";
import { hasDay, markDay, recordCloses } from "./history";

export type DayRow = {
  date: string; // YYYY-MM-DD
  symbol: string;
  sectorCode: string;
  name: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  ldcp: number;
  change: number; // % vs previous close
  xd: boolean; // traded ex-dividend that day
  exFlags: string[]; // PSX entitlement marks: XD (dividend), XB (bonus), XR (rights)
};

export type Day = { date: string; rows: Map<string, DayRow> };

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MONTHS: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

/** Extract the first file of a ZIP archive (deflate or stored). */
function unzipFirst(buf: Buffer): string {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0) throw new Error("not a zip");
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10);
  const size = buf.readUInt32LE(cd + 20);
  const off = buf.readUInt32LE(cd + 42);
  const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
  const data = buf.subarray(start, start + size);
  return (method === 0 ? data : zlib.inflateRawSync(data)).toString("latin1");
}

function parse(text: string): Map<string, DayRow> {
  const rows = new Map<string, DayRow>();
  for (const line of text.split(/\r?\n/)) {
    const f = line.split("|");
    if (f.length < 10) continue;
    const m = /^(\d{2})([A-Z]{3})(\d{4})$/.exec(f[0].trim());
    if (!m) continue;
    const close = Number(f[7]);
    const ldcp = Number(f[9]);
    if (!Number.isFinite(close) || close <= 0) continue;
    const rawName = f[3].trim();
    const suffix = /((?:XD|XB|XR)+)$/.exec(rawName)?.[1] ?? "";
    const exFlags: string[] = suffix.match(/X[DBR]/g) ?? [];
    const symbol = f[1].trim();
    rows.set(symbol, {
      date: `${m[3]}-${MONTHS[m[2]]}-${m[1]}`,
      symbol,
      sectorCode: f[2].trim(),
      name: rawName.slice(0, rawName.length - suffix.length).trim(),
      open: Number(f[4]),
      high: Number(f[5]),
      low: Number(f[6]),
      close,
      volume: Number(f[8]) || 0,
      ldcp,
      change: ldcp > 0 ? (close / ldcp - 1) * 100 : 0,
      xd: exFlags.includes("XD"),
      exFlags,
    });
  }
  return rows;
}

const iso = (d: Date) => d.toISOString().slice(0, 10);

const isOld = (date: string) => Date.now() - Date.parse(date + "T00:00:00Z") > 3 * 86_400_000;

/** Download and parse one day's file, saving its closes to history. Null when PSX has no file (holiday, not yet published). */
async function fetchDay(date: string): Promise<Day | null> {
  const res = await fetch(`https://dps.psx.com.pk/download/mkt_summary/${date}.Z`, { headers: { "User-Agent": UA }, cache: "no-store" });
  if (!res.ok) {
    if (isOld(date)) markDay(date);
    return null;
  }
  const rows = parse(unzipFirst(Buffer.from(await res.arrayBuffer())));
  if (!rows.size) return null;
  recordCloses(Object.fromEntries([...rows.values()].map((r) => [r.symbol, r.close])), date);
  markDay(date);
  return { date, rows };
}

/** One day's summary (cached). */
export function getDay(date: string): Promise<Day | null> {
  return cached(`psxday:${date}`, isOld(date) ? 7 * 86_400_000 : 10 * 60_000, () => fetchDay(date));
}

/** Candidate trading dates (weekdays) going back from today, Pakistan time. */
function weekdaysBack(count: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.now() + 5 * 3600_000);
  while (out.length < count) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) out.push(iso(d));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

/** The most recent `n` trading days that have a summary file, newest first. */
export function getRecentDays(n = 3): Promise<Day[]> {
  return cached(`psxdays:${n}`, 10 * 60_000, async () => {
    const days: Day[] = [];
    for (const date of weekdaysBack(n + 10)) {
      const day = await getDay(date).catch(() => null);
      if (day) days.push(day);
      if (days.length >= n) break;
    }
    return days;
  });
}

const g = globalThis as unknown as { __pkBackfill?: Promise<void> };

/**
 * One-time background fill of ~13 months of daily closes so PSX charts, MTD,
 * YTD and YoY work straight away. Days already stored are skipped, and files
 * are fetched two at a time with a pause, to stay light on PSX.
 */
export function startBackfill(days = process.env.VERCEL ? 45 : 400) {
  // On Vercel the deploy already ships ~13 months (scripts/backfill.mjs), so only the days since then are fetched.
  if (g.__pkBackfill) return;
  const todo = weekdaysBack(Math.round((days * 5) / 7)).filter((d) => !hasDay(d));
  if (!todo.length) return;
  console.log(`[psx] backfilling ${todo.length} days of market summaries…`);
  g.__pkBackfill = (async () => {
    for (let i = 0; i < todo.length; i += 2) {
      // fetchDay, not getDay: the backfill only needs closes saved, not the full rows kept in memory.
      await Promise.all(todo.slice(i, i + 2).map((d) => fetchDay(d).catch(() => null)));
      await new Promise((r) => setTimeout(r, 400));
    }
    console.log("[psx] backfill complete");
  })();
}
