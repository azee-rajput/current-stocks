// TEMPORARY diagnostic: where the server looks for the history file and what it finds. Remove after debugging.
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  const file = path.join(process.cwd(), "data", "psx-history.json");
  let info: Record<string, unknown> = { exists: fs.existsSync(file) };
  try {
    const s = JSON.parse(fs.readFileSync(file, "utf8"));
    info = { ...info, bytes: fs.statSync(file).size, keys: Object.keys(s).length, meblDays: Object.keys(s.MEBL ?? {}).length, days: Object.keys(s.__days ?? {}).length };
  } catch (e) {
    info.error = String(e);
  }
  let dataDir: string[] = [];
  try {
    dataDir = fs.readdirSync(path.join(process.cwd(), "data"));
  } catch (e) {
    dataDir = [String(e)];
  }
  return Response.json({ region: process.env.VERCEL_REGION, cwd: process.cwd(), cwdFiles: fs.readdirSync(process.cwd()).slice(0, 30), dataDir, info });
}
