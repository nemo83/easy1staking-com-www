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


export type ProjectOverview = {
  headline: string;
  emphasis: string;
  lead: string;
  features: readonly { title: string; body: string }[];
  connection: string;
};

/** Supporting-page copy from the approved Editorial references. */
export const projectOverviews: Record<EditorialProject["slug"], ProjectOverview> = {
  adawatch: {
    headline: "Cardano activity.", emphasis: "Right in your chat.",
    lead: "Wallet, DeFi and NFT notifications through Telegram and Discord. A bot that brings Cardano activity into the conversations you already use.",
    features: [
      { title: "Wallet activity", body: "Follow Cardano wallet activity through notifications." },
      { title: "DeFi and NFTs", body: "Keep track of loan positions and NFT activity from chat." },
      { title: "Telegram and Discord", body: "Choose the chat platform you already use; the AdaWatch website explains how to get started." },
    ],
    connection: "I built AdaWatch to make Cardano activity easier to follow from chat. Its website is the introduction; the bot is the product.",
  },
  adamatic: {
    headline: "Payments on Cardano.", emphasis: "Less manual work.",
    lead: "Smart contract payment automation on Cardano. HOSKY auto-pulls are available today, with recurring ADA payments on the roadmap.",
    features: [
      { title: "Available today", body: "HOSKY auto-pulls are the live offering on the current product site." },
      { title: "On the roadmap", body: "Recurring ADA payments remain upcoming capabilities." },
      { title: "The product destination", body: "Visit AdaMatic for the current setup flow, payment information and FAQ." },
    ],
    connection: "AdaMatic connects my smart contract work with a practical payment problem: automating actions that would otherwise need to be repeated manually.",
  },
  "uplc-link": {
    headline: "The source. The script.", emphasis: "Make the connection.",
    lead: "Verify Aiken source code against on-chain Cardano scripts, and explore a registry of verified contracts.",
    features: [
      { title: "Source verification", body: "Compare compiled source with the script deployed on Cardano." },
      { title: "Verified-contract registry", body: "Explore contracts that have been verified through the tool." },
      { title: "A developer workflow", body: "Use the independent product site for verification, registry browsing and documentation." },
    ],
    connection: "UPLC Link is about making the relationship between source code and a deployed script visible. It is part of the developer tooling I build under EASY1.",
  },
  "cardano-dev-skills": {
    headline: "Better Cardano context.", emphasis: "For coding agents.",
    lead: "Developer skills, bundled documentation and project context for AI coding agents, including Claude Code and Codex.",
    features: [
      { title: "Developer workflows", body: "Focused guides for common tasks such as writing validators, building transactions and debugging." },
      { title: "Bundled documentation", body: "Cardano project documentation available alongside the skills." },
      { title: "Project context", body: "Instructions that guide coding agents toward the relevant Cardano knowledge." },
    ],
    connection: "I started Cardano Dev Skills and handed it over to the Cardano Foundation. It is still my baby: a project that began with me and now lives with the wider Cardano ecosystem.",
  },
};
