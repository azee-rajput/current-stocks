// TEMPORARY diagnostic: reports how PSX responds to this server. Remove after debugging.
export const dynamic = "force-dynamic";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

export async function GET() {
  const urls = [
    "https://dps.psx.com.pk/indices",
    "https://dps.psx.com.pk/indices/KSE100",
    "https://dps.psx.com.pk/company/MEBL",
    "https://dps.psx.com.pk/download/mkt_summary/2026-11-17.Z",
  ];
  const out = await Promise.all(urls.map(async (url) => {
    const t = Date.now();
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "text/html,*/*" }, cache: "no-store" });
      const body = await res.text();
      return { url, status: res.status, ms: Date.now() - t, bytes: body.length, title: /<title>([^<]*)/.exec(body)?.[1] ?? null,
        rows: (body.match(/tbl__symbol/g) ?? []).length, indexTiles: (body.match(/topIndices__item__name/g) ?? []).length, server: res.headers.get("server") };
    } catch (e) {
      return { url, error: String(e), ms: Date.now() - t };
    }
  }));
  return Response.json({ region: process.env.VERCEL_REGION, out });
}
