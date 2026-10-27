import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Nav from "@/components/Nav";
import Disclaimer from "@/components/Disclaimer";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "PK Markets — PSX, Gold, Oil & PKR dashboard",
  description: "Live dashboards for the Pakistan Stock Exchange, KSE-100, Shariah-compliant stocks, gold, silver, copper, oil and PKR currencies, with automated outlooks.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <header className="sticky top-0 z-30 bg-surface/95 backdrop-blur">
          <Nav />
          <Disclaimer />
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-7xl px-4 pb-8 text-xs text-text-2">
          Data: Pakistan Stock Exchange public pages (dps.psx.com.pk), Yahoo Finance (commodities &amp; FX), Google News RSS. Prices may be delayed.
          Gold/silver in PKR are international parity (USD price × USD/PKR), and exclude local sarafa premiums.
          Nothing here is financial advice.
        </footer>
      </body>
    </html>
  );
}
