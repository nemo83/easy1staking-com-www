"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { poolPreviewNotice } from "@/lib/site/editorial";

const links = [{ href: "/#projects", label: "Projects" }, { href: "/pool", label: "Pool" }, { href: "/about", label: "About" }, { href: "/blog", label: "Blog" }];

export function SiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!open) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); button.current?.focus(); }
    }
    function closeOutside(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("keydown", closeOnEscape);
    document.addEventListener("pointerdown", closeOutside);
    return () => { document.removeEventListener("keydown", closeOnEscape); document.removeEventListener("pointerdown", closeOutside); };
  }, [open]);
  return (
    <header className="site-header wrap" ref={container}>
      <Link className="brand" href="/" aria-label="easy1staking home" onClick={() => setOpen(false)}><Image src="/brand/assets/easy1-horizontal-colour-dark.svg" alt="easy1staking" width={218} height={52} priority /></Link>
      <nav className="desktop-nav" aria-label="Main navigation">{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined}>{link.label}</Link>)}</nav>
      <div className="nav-pool"><Link className="stake-nav" href="/pool" aria-describedby="nav-pool-notice" onClick={() => setOpen(false)}>Stake with EASY1 <span aria-hidden="true">↗</span></Link><p id="nav-pool-notice">{poolPreviewNotice}</p></div>
      <button ref={button} type="button" className="mobile-menu-button" aria-expanded={open} aria-controls="mobile-navigation" onClick={() => setOpen(!open)}>Menu <span aria-hidden="true">{open ? "−" : "+"}</span></button>
      <nav id="mobile-navigation" className="mobile-navigation" aria-label="Mobile navigation" hidden={!open} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget) && event.relatedTarget !== button.current) setOpen(false); }}>{links.map(link => <Link key={link.href} href={link.href} aria-current={pathname === link.href ? "page" : undefined} onClick={() => setOpen(false)}>{link.label}</Link>)}</nav>
    </header>
  );
}
