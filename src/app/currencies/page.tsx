import AssetClassPage from "@/components/AssetClassPage";

export const dynamic = "force-dynamic";

export default function CurrenciesPage() {
  return (
    <AssetClassPage kind="currency" title="Currencies vs Pakistani Rupee"
      intro="Rupees per unit of foreign currency (interbank/market mid rates). A rising figure means the rupee is weakening. Open-market exchange company rates may differ slightly." />
  );
}
