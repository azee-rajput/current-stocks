"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/** Re-runs the page's server rendering on an interval so figures stay live. */
export default function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [updated, setUpdated] = useState<string>("");
  useEffect(() => {
    setUpdated(new Date().toLocaleTimeString());
    const id = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      start(() => router.refresh());
      setUpdated(new Date().toLocaleTimeString());
    }, seconds * 1000);
    return () => clearInterval(id);
  }, [router, seconds]);
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-text-2">
      <span className={`h-2 w-2 rounded-full ${pending ? "animate-pulse bg-accent" : "bg-up"}`} aria-hidden />
      Live · refreshes every {seconds}s{updated && ` · updated ${updated}`}
    </span>
  );
}
