import AssetClassPage from "@/components/AssetClassPage";

export const dynamic = "force-dynamic";

export default function CommoditiesPage() {
  return (
    <AssetClassPage kind="commodity" title="Commodities"
      intro="Gold, silver, copper, platinum and energy futures. PKR-per-tola prices are international parity (1 tola = 11.664 g), converted at the live USD/PKR rate. Local sarafa rates usually carry a premium." />
  );
}
