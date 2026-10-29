import Image from "next/image";
import Link from "next/link";
import { editorialSocials } from "@/lib/site/editorial";
import { ExternalLink } from "./EditorialSections";

export function SiteFooter() {
  return <footer className="site-footer wrap">
    <div><Link href="/" aria-label="easy1staking home"><Image src="/brand/assets/easy1-horizontal-colour-dark.svg" alt="easy1staking" width={180} height={43} /></Link><p>Built and operated by Giovanni.<br />Rooted in Cardano since 2020.</p></div>
    <nav aria-label="Footer"><ExternalLink href={editorialSocials.x}>X</ExternalLink><ExternalLink href={editorialSocials.github}>GitHub</ExternalLink><a href="/brand/index.html">Brand media <span aria-hidden="true">↗</span></a></nav>
    <span className="footer-note">Built here. Shared with Cardano.</span>
  </footer>;
}
