import { siteConfig } from "@/lib/site/config";
import { Wordmark } from "./Wordmark";

function Col({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-low">
        {title}
      </div>
      {children}
    </div>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="text-[14px] text-ink-mid transition-colors hover:text-ink-high"
    >
      {children}
    </a>
  );
}

/** long bech32 ids — mono, label above, wraps instead of overflowing */
function IdField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[13px] text-ink-low">{label}</span>
      <span className="break-all font-mono text-[12px] text-ink-mid">
        {value}
      </span>
    </div>
  );
}

export function SiteFooter() {
  const { pool, governance, socials, contactEmail } = siteConfig;

  return (
    <footer className="border-t border-line bg-bg-deep px-6 py-16 md:px-16">
      <div className="grid gap-10 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Wordmark />
          <p className="mt-4 max-w-[34ch] text-[14px] leading-[1.55] text-ink-mid">
            {siteConfig.tagline}
          </p>
        </div>

        <Col title="Pool">
          <IdField label={`Ticker · ${pool.ticker}`} value={pool.id} />
          <FooterLink href={pool.delegateHref}>Delegate stake →</FooterLink>
        </Col>

        <Col title="Governance">
          <IdField label="DRep ID" value={governance.drepId} />
          <FooterLink href={governance.href}>Governance / DRep →</FooterLink>
        </Col>

        <Col title="Connect">
          <FooterLink href={`mailto:${contactEmail}`}>{contactEmail}</FooterLink>
          <FooterLink href={socials.x} external>
            X / Twitter
          </FooterLink>
          <FooterLink href={socials.github} external>
            GitHub
          </FooterLink>
          {socials.telegram && (
            <FooterLink href={socials.telegram} external>
              Telegram
            </FooterLink>
          )}
          {socials.discord && (
            <FooterLink href={socials.discord} external>
              Discord
            </FooterLink>
          )}
        </Col>
      </div>

      <div className="mt-14 flex flex-col gap-2 border-t border-line pt-6 font-mono text-[11px] text-ink-low md:flex-row md:items-center md:justify-between">
        <span>
          © 2020–2026 {siteConfig.name} · {pool.ticker}
        </span>
        <span>Built on Cardano since 2020.</span>
      </div>
    </footer>
  );
}
