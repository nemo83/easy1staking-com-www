/** Approved marketing content. No wallet or live-data dependencies. */
export type EditorialProject = {
  slug: "adawatch" | "adamatic" | "uplc-link" | "cardano-dev-skills";
  name: string;
  shortName: string;
  category: string;
  summary: string;
  role: string;
  credit?: string;
  url: string;
  sourceUrl?: string;
  siteLabel: string;
  icon: string;
  capture: string;
  captureAlt: string;
  accent: string;
  features: readonly string[];
};

export const editorialProjects: readonly EditorialProject[] = [
  {
    slug: "adawatch", name: "AdaWatch", shortName: "AdaWatch",
    category: "Notifications & chat tools",
    summary: "Your Cardano activity, in your pocket. Wallet, DeFi and NFT notifications through Telegram and Discord.",
    role: "Built by Giovanni · An EASY1 project",
    url: "https://adawatchbot.xyz", siteLabel: "adawatchbot.xyz",
    icon: "/images/projects/ada-watch.svg", capture: "/images/projects/adawatch.png",
    captureAlt: "Actual AdaWatch website showing Cardano notifications through Telegram and Discord",
    accent: "#5D9EF7",
    features: ["Wallet, DeFi and NFT notifications", "Delivered through Telegram and Discord", "The website explains the bot and how to use it"],
  },
  {
    slug: "adamatic", name: "AdaMatic", shortName: "AdaMatic",
    category: "Payment automation",
    summary: "Automate payments on Cardano. HOSKY auto-pulls are live; recurring ADA payments are on the roadmap.",
    role: "Built by Giovanni · An EASY1 project",
    url: "https://adamatic.xyz", siteLabel: "adamatic.xyz",
    icon: "/images/projects/adamatic.svg", capture: "/images/projects/adamatic.png",
    captureAlt: "Actual AdaMatic website showing HOSKY auto-pulls and recurring ADA payments on the roadmap",
    accent: "#35D5DA",
    features: ["HOSKY auto-pulls are available today", "Recurring ADA payments remain on the roadmap"],
  },
  {
    slug: "uplc-link", name: "UPLC Link", shortName: "UPLC Link",
    category: "Smart contract verification",
    summary: "Don't trust. Verify. Compare Aiken source with on-chain scripts and explore verified Cardano contracts.",
    role: "Built by Giovanni · An EASY1 project",
    url: "https://uplc.link", siteLabel: "uplc.link",
    icon: "/images/projects/uplc-link.svg", capture: "/images/projects/uplc-link.png",
    captureAlt: "Actual UPLC Link website with smart contract verification and a registry of verified contracts",
    accent: "#A69AF8",
    features: ["Compare Aiken source with on-chain scripts", "Explore the registry of verified Cardano contracts"],
  },
  {
    slug: "cardano-dev-skills", name: "Cardano Dev Skills", shortName: "Dev Skills",
    category: "Open-source developer tooling",
    summary: "Cardano knowledge for AI coding agents. Skills, bundled documentation and project context for Claude Code and Codex.",
    role: "Originated by Giovanni · Now with the Cardano Foundation",
    credit: "Started by Giovanni · Handed over to the Cardano Foundation",
    url: "https://cardano-foundation.github.io/cardano-dev-skills/",
    sourceUrl: "https://github.com/cardano-foundation/cardano-dev-skills",
    siteLabel: "Cardano Foundation · official website",
    icon: "/images/projects/cardano-dev-skills.svg", capture: "/images/projects/cardano-dev-skills.png",
    captureAlt: "Actual Cardano Dev Skills website with skills and bundled documentation for AI coding agents",
    accent: "#8EA9F5",
    features: ["Skills and bundled Cardano documentation for AI coding agents", "Project context for Claude Code and Codex", "Started by Giovanni and handed over to the Cardano Foundation"],
  },
];

export type UpcomingArticle = {
  title: string;
  category: string;
  art: "origins" | "debugging" | "inside";
  status: "coming-soon";
};
export const upcomingArticles: readonly UpcomingArticle[] = [
  { title: "From stake pool operator to Cardano developer", category: "Story", art: "origins", status: "coming-soon" },
  { title: "A real debugging walkthrough using uplc.link", category: "Walkthrough", art: "debugging", status: "coming-soon" },
  { title: "Inside AdaMatic", category: "Engineering", art: "inside", status: "coming-soon" },
];

export const editorialSocials = {
  x: "https://x.com/cryptojoe101",
  github: "https://github.com/easy1staking-com",
} as const;
export const easy1PoolId = "pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm";
export const poolPreviewNotice = "Read-only pool overview. In-site delegation is not included in this preview.";
