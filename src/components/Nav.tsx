"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const LINKS = [
  { href: "/", label: "Overview" },
  { href: "/psx", label: "PSX / KSE-100" },
  { href: "/shariah", label: "Shariah" },
  { href: "/commodities", label: "Commodities" },
  { href: "/currencies", label: "Currencies" },
  { href: "/insights", label: "Predictions & Picks" },
  { href: "/watchlist", label: "Watchlist" },
];

export default function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <nav className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
      <Link href="/" className="flex items-center gap-2 font-semibold whitespace-nowrap">
        <span className="grid h-7 w-7 place-items-center rounded-md bg-accent text-sm text-white">₨</span>
        PK Markets
      </Link>
      <button className="ml-auto rounded-md border border-border px-2 py-1 text-sm md:hidden" onClick={() => setOpen(!open)} aria-expanded={open}>
        Menu
      </button>
      <ul className={`${open ? "flex" : "hidden"} absolute top-14 right-4 left-4 z-20 flex-col gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg md:static md:flex md:flex-row md:border-0 md:bg-transparent md:p-0 md:shadow-none`}>
        {LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} onClick={() => setOpen(false)}
              className={`block rounded-md px-3 py-1.5 text-sm whitespace-nowrap ${active(l.href) ? "bg-surface-2 font-medium text-text" : "text-text-2 hover:text-text"}`}>
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
