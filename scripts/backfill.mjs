// Build-time PSX history backfill (runs before `next build`).
// Downloads PSX's public daily market summary files for the last ~13 months
// and stores each stock's daily close in data/psx-history.json, so a fresh
// deploy (e.g. on Vercel, whose disk is read-only at runtime) ships with
// full price history. Days already stored are skipped.
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const FILE = path.join(process.cwd(), "data", "psx-history.json");
const DAYS = Number(process.env.BACKFILL_DAYS) || 400; // calendar days to cover
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";
const MONTHS = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };

function unzipFirst(buf) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const cd = buf.readUInt32LE(eocd + 16);
  const method = buf.readUInt16LE(cd + 10);
  const size = buf.readUInt32LE(cd + 20);
  const off = buf.readUInt32LE(cd + 42);
  const start = off + 30 + buf.readUInt16LE(off + 26) + buf.readUInt16LE(off + 28);
  const data = buf.subarray(start, start + size);
  return (method === 0 ? data : zlib.inflateRawSync(data)).toString("latin1");
}

/** symbol -> close for one day's file (same format as src/lib/psxDaily.ts parses). */
function parseCloses(text) {
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const f = line.split("|");
    if (f.length < 10 || !/^\d{2}[A-Z]{3}\d{4}$/.test(f[0].trim())) continue;
    const close = Number(f[7]);
    if (close > 0) out[f[1].trim()] = close;
  }
  return out;
}

function weekdaysBack(count) {
  const out = [];
  const d = new Date(Date.now() + 5 * 3600_000); // Pakistan time
  while (out.length < count) {
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return out;
}

let store = {};
try {
  store = JSON.parse(fs.readFileSync(FILE, "utf8"));
} catch {}
store.__days ??= {};

const todo = weekdaysBack(Math.round((DAYS * 5) / 7)).filter((d) => !store.__days[d]);
console.log(`[backfill] ${todo.length} days to fetch`);
let ok = 0;
for (let i = 0; i < todo.length; i += 4) {
  await Promise.all(
    todo.slice(i, i + 4).map(async (date) => {
      try {
        const res = await fetch(`https://dps.psx.com.pk/download/mkt_summary/${date}.Z`, { headers: { "User-Agent": UA } });
        const old = Date.now() - Date.parse(date + "T00:00:00Z") > 3 * 86_400_000;
        if (!res.ok) {
          if (old) store.__days[date] = 1; // holiday: don't retry
          return;
        }
        const closes = parseCloses(unzipFirst(Buffer.from(await res.arrayBuffer())));
        for (const [sym, v] of Object.entries(closes)) (store[sym] ??= {})[date] = v;
        store.__days[date] = 1;
        ok++;
      } catch (e) {
        console.warn(`[backfill] ${date}: ${e.message}`);
      }
    }),
  );
  await new Promise((r) => setTimeout(r, 200));
}
fs.mkdirSync(path.dirname(FILE), { recursive: true });
fs.writeFileSync(FILE, JSON.stringify(store));
console.log(`[backfill] stored ${ok} new trading days -> ${path.relative(process.cwd(), FILE)}`);
