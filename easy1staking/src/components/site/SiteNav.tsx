import { navLinks, siteConfig } from "@/lib/site/config";
import { Wordmark } from "./Wordmark";

export function SiteNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-line/60 bg-bg/80 backdrop-blur-md">
      <nav className="flex items-center justify-between px-6 py-4 md:px-16">
        <Wordmark />

        <div className="flex items-center gap-2 md:gap-6">
          <div className="hidden items-center gap-6 md:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-[14px] text-ink-mid transition-colors hover:text-ink-high"
              >
                {link.label}
              </a>
            ))}
          </div>

          <a
            href={siteConfig.pool.delegateHref}
            className="btn btn-primary px-4 py-2.5 text-[14px]"
          >
            Delegate <span className="arrow">→</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
