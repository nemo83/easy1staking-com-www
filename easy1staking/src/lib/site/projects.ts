/**
 * The three-tier portfolio that powers the "My Contribution to Cardano" grid.
 *
 *  Tier 1 — the brand itself (easy1 stake pool, featured)
 *  Tier 2 — partnerships / cooperation (software operated FOR others)  -> "Operations & Infrastructure"
 *  Tier 3 — own initiatives (own products, own domains)                -> "Apps & Tools"
 *
 * Copy and URLs are placeholders where noted — replace before public launch.
 */

export type ProjectBadge = {
  label: string;
  /** visual tone — maps to the badge styles in ContributionGrid */
  tone?: "default" | "os" | "flag" | "ops";
};

export type Project = {
  /** mono initials shown in the card icon */
  initials: string;
  role: string;
  name: string;
  description: string;
  href: string;
  badges: ProjectBadge[];
  featured?: boolean;
};

/** Tier 1 + Tier 2 — services the ecosystem consumes; the pool is the flagship. */
export const operations: Project[] = [
  {
    initials: "E1",
    role: "Stake Pool Operator · since Oct 2020",
    name: "easy1 Stake Pool",
    description:
      "Reliable Cardano stake pool. 4,000+ blocks produced, 1,100+ delegators, 200K ADA pledged, 0% margin. Operated by a builder.",
    href: "#delegate",
    badges: [
      { label: "Flagship", tone: "flag" },
      { label: "6 yrs", tone: "ops" },
    ],
    featured: true,
  },
  {
    initials: "SS",
    role: "Scooper operator",
    name: "SundaeSwap Scooper",
    description:
      "Operating a scooper node — processing batch orders for one of Cardano's largest DEXs.",
    href: "https://sundae.fi",
    badges: [{ label: "Live", tone: "ops" }],
  },
  {
    initials: "BO",
    role: "Oracle operator",
    name: "Butane Oracle",
    description:
      "Providing price feed data to Butane Protocol — keeping Cardano DeFi honest.",
    href: "https://butane.dev",
    badges: [{ label: "Live", tone: "ops" }],
  },
  {
    initials: "MY",
    role: "Operator", // TODO: confirm exact Mythril role (oracle? node? scooper?)
    name: "Mythril",
    description:
      "[TODO: confirm what you operate for Mythril and the one-line description.]",
    href: "#", // TODO: real Mythril URL
    badges: [{ label: "Live", tone: "ops" }],
  },
];

/** Tier 3 — own initiatives, each on its own domain. */
export const apps: Project[] = [
  {
    initials: "AM",
    role: "App · partial OS",
    name: "adamatic",
    description:
      "Automated Cardano transaction tooling. On-chain components open source.",
    href: "https://adamatic.io",
    badges: [{ label: "Onchain OS", tone: "os" }],
  },
  {
    initials: "AW",
    role: "App · bot",
    name: "adawatch · adawatchbot",
    description:
      "Real-time alerts and monitoring for Cardano. Track wallets, pools, and on-chain events.",
    href: "https://adawatch.io",
    badges: [{ label: "Closed", tone: "default" }],
  },
  {
    initials: "SH",
    role: "App · open source",
    name: "shithole.app",
    description:
      "Open-source Cardano tool. [Short description placeholder — real copy TBD.]",
    href: "https://shithole.app",
    badges: [{ label: "Open source", tone: "os" }],
  },
  {
    initials: "UL",
    role: "App · open source",
    name: "uplc.link",
    description:
      "Shareable links for inspecting UPLC. Decode, compare, debug on-chain Plutus scripts in the browser.",
    href: "https://uplc.link",
    badges: [{ label: "Open source", tone: "os" }],
  },
];
