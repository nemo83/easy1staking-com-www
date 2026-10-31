"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

export function LegacyFragments() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname !== "/") return;
    function resolveFragment() {
      if (window.location.pathname !== "/") return;
      if (window.location.hash === "#delegate") {
        window.location.replace("/pool#delegate");
      } else if (window.location.hash === "#contribution") {
        window.history.replaceState(window.history.state, "", `${window.location.pathname}${window.location.search}#projects`);
        const target = document.getElementById("projects");
        target?.focus({ preventScroll: true });
        target?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      }
    }
    resolveFragment();
    window.addEventListener("hashchange", resolveFragment);
    return () => window.removeEventListener("hashchange", resolveFragment);
  }, [pathname]);

  return null;
}
