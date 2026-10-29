import type { Metadata } from "next";
import "./globals.css";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export const metadata: Metadata = {
  metadataBase: new URL("https://easy1staking.com"),
  title: { default: "EASY1 — Built on Cardano. Made to be used.", template: "%s | EASY1" },
  description: "Giovanni's Cardano projects, open-source work and the EASY1 stake pool where it all started. Explore AdaWatch, AdaMatic, UPLC Link and Cardano Dev Skills.",
  openGraph: { type: "website", url: "/", siteName: "easy1staking", images: [{ url: "/brand/assets/easy1-share-card-dark.png", width: 1200, height: 630, alt: "easy1staking — Connected Soft identity" }] },
  twitter: { card: "summary_large_image", images: ["/brand/assets/easy1-share-card-dark.png"] },
  icons: { icon: [{ url: "/brand/assets/easy1-icon-32.png", sizes: "32x32", type: "image/png" }, { url: "/brand/assets/easy1-icon-192.png", sizes: "192x192", type: "image/png" }], apple: { url: "/brand/assets/easy1-icon-180.png", sizes: "180x180" } },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body className="bg-bg font-sans text-ink-high antialiased"><a className="skip-link" href="#main-content">Skip to content</a><SiteNav />{children}<SiteFooter /></body></html>;
}
