# PK Markets

A Next.js dashboard for Pakistan's markets: PSX / KSE-100, Shariah-compliant stocks (KMI-30, KMI All Share), gold, silver, copper, platinum, crude oil, gasoline, natural gas and PKR exchange rates. It shows live figures, MTD, YTD, 1-year and same-month-last-year changes, charts, news sentiment, a rule-based rise/fall outlook, stable-stock screens and model picks.

> Predictions are automated estimates, **not financial advice**. Act on them at your own risk.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. Pages refresh every 60 seconds.

## Deploy (Vercel)

Import the GitHub repo in Vercel and keep the default Next.js settings. The `prebuild` step (`scripts/backfill.mjs`) downloads about 13 months of PSX daily closes during each build and bundles them with the app. Vercel's disk is read-only at runtime, so days after the deploy are kept in memory only. Redeploy now and then to refresh the bundled history. `vercel.json` runs the functions in Mumbai (`bom1`), the region closest to PSX.

## Pages

| Route | What it shows |
|---|---|
| `/` | Index tiles, gainers/losers/most active, commodities, currencies, market news, outlook snapshot |
| `/psx` | KSE-100 with period returns and chart, all PSX indices, sortable/searchable KSE-100 table |
| `/shariah` | Islamic indices, KMI-30 and KMI All Share constituents |
| `/commodities`, `/currencies` | Cards and a performance table (Today, MTD, YTD, 1Y, vs same month last year) |
| `/asset/[id]` | Chart (1D…5Y with 50-day average), stats, monthly closes with MoM/YoY, outlook breakdown, news |
| `/stock/[symbol]` | PSX company quote, 52-week position, YTD / 1-year change, outlook, news |
| `/insights` | Asset-class comparison in PKR, top picks, top Shariah picks, most stable, weakest, full screener |
| `/watchlist` | Starred stocks and assets (saved in your browser) |

## Data sources (all free)

- **PSX**: public pages on dps.psx.com.pk (index values, index constituents, company quote pages). Responses are cached (60 s for indices, 15 min for company pages), and company pages are fetched 4 at a time.
- **Commodities & FX**: Yahoo Finance chart endpoint (futures: `GC=F`, `SI=F`, `HG=F`, `PL=F`, `BZ=F`, `CL=F`, `RB=F`, `NG=F`).
  Yahoo's PKR quotes sometimes flip between two feeds, so USD/PKR is anchored on the SAR and AED rates (both pegged to USD). The other PKR pairs and the PKR gold/silver prices are derived from that cleaned rate.
- **News**: Google News RSS, scored with a finance word list.

### PSX history

PSX publishes a daily market summary file (`dps.psx.com.pk/download/mkt_summary/<date>.Z`) with every stock's open, high, low, close, volume and previous close. When the server first starts, it downloads about 13 months of these files in the background, two at a time with a pause between them. After that it only fetches new days. Closes are saved to `data/psx-history.json`, which drives the stock charts, technical indicators, MTD, YTD, YoY and the 3-day change. The KSE-100 index itself isn't in these files, so its chart is still built from live readings.

The stock page also shows the last 3 trading days. Each day lists the likely reasons for the move (`src/lib/moves.ts`):
- ex-dividend, ex-bonus and ex-rights adjustments
- the KSE-100 and sector moves that day
- out- or underperformance against the sector
- volume against the 10-day average
- opening gaps, where the price closed in the day's range, and circuit limits
- that day's company and market news

## Prediction model (`src/lib/analytics.ts`)

The score runs from −100 to +100. It combines:
- price vs the 20-, 50- and 200-day averages
- 1-month momentum and RSI(14)
- news tone
- for PSX stocks with little local history: YTD, 1-year change, 52-week position and P/E

A score of +12 or more is "Likely rise", −12 or less is "Likely fall", and anything in between is "Sideways". Confidence is capped at 80%.
The stability score uses volatility and drawdown when there is history, and otherwise the width of the 52-week range.
