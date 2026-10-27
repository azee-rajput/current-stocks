import AutoRefresh from "@/components/AutoRefresh";
import StockTable from "@/components/StockTable";
import { Change, Notice, Section } from "@/components/ui";
import { getConstituents, getIndices } from "@/lib/market";
import { fmt } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ShariahPage() {
  const [indices, kmi30, all] = await Promise.all([
    getIndices().catch(() => []),
    getConstituents("KMI30").catch(() => []),
    getConstituents("KMIALLSHR").catch(() => []),
  ]);
  const islamic = indices.filter((i) => ["KMI30", "KMIALLSHR", "MII30", "JSMFI", "MZNPI"].includes(i.code));
  const row = (c: (typeof all)[number]) => ({ ...c, shariah: true });

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Shariah-compliant stocks</h1>
          <p className="max-w-3xl text-sm text-text-2">
            Stocks in the KMI All Share Islamic Index, screened by PSX and Al Meezan for Shariah compliance (business activity,
            interest-bearing debt, non-compliant income and liquid assets). Compliance is reviewed periodically, so check the latest list before investing.
          </p>
        </div>
        <AutoRefresh seconds={60} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-5">
        {islamic.map((i) => (
          <div key={i.code} className="card p-4">
            <div className="text-xs font-medium text-text-2">{i.code}</div>
            <div className="num text-xl font-semibold">{fmt(i.value)}</div>
            <Change value={i.changePct} className="text-sm" />
          </div>
        ))}
      </div>

      <Section title="KMI-30" subtitle="The 30 largest, most liquid Shariah-compliant companies">
        {kmi30.length ? <StockTable rows={kmi30.map(row)} showShariahFilter={false} pageSize={30} /> : <Notice>Could not load KMI-30 right now.</Notice>}
      </Section>

      <Section title="KMI All Share" subtitle={`All ${all.length} Shariah-compliant listed companies`}>
        {all.length ? <StockTable rows={all.map(row)} showShariahFilter={false} pageSize={50} /> : <Notice>Could not load KMI All Share right now.</Notice>}
      </Section>
    </div>
  );
}
