const TEXT =
  "⚠ DISCLAIMER: Predictions, signals and picks on this site are generated automatically from price trends and news headlines. They are NOT financial advice. Act on the predictions at your own risk. Data is from free public sources and may be delayed or inaccurate. Consult a licensed financial advisor before investing.";

export default function Disclaimer() {
  return (
    <div className="overflow-hidden border-y border-border bg-warn-bg py-1.5 text-xs font-medium text-warn-text" role="note" aria-label="Disclaimer">
      <div className="marquee" style={{ ["--marquee-duration" as string]: "45s" }}>
        <span className="px-8">{TEXT}</span>
        <span className="px-8" aria-hidden>{TEXT}</span>
      </div>
    </div>
  );
}
