/**
 * Site identity / config. Values marked TODO are placeholders — replace with
 * the real verifiable identity before public launch (pool ID, DRep ID, socials).
 */
export const siteConfig = {
  name: "easy1staking",
  tagline: "Reliable Cardano infrastructure, operated by a builder since 2020.",

  pool: {
    ticker: "EASY1",
    id: "pool1yr0cv3dtmhcfgqa6yetvmf769ngk89e6tepecmjrmjl2jzcw2lm",
    idHex: "20df8645abddf09403ba2656cda7da2cd163973a5e439c6e43dcbea9",
    delegateHref: "#delegate",
  },

  governance: {
    drepId: "drep1ytn29gxylzlrhzmkt4c75w7qmesxqc248r9089f0pvuysdqeva6ht",
    // raw 28-byte DRep key hash (from Koios drep_info) — used to build the vote-delegation cert
    drepIdHex: "e6a2a0c4f8be3b8b765d71ea3bc0de6060615538caf3952f0b384834",
    href: "#governance", // TODO: governance / DRep page route
  },

  contactEmail: "gm@easy1staking.com", // TODO: confirm contact address

  socials: {
    x: "https://x.com/easy1staking", // TODO: confirm handle
    github: "https://github.com/easy1staking", // TODO: confirm org/user
    telegram: "https://t.me/easy1staking", // TODO: confirm
    discord: "", // optional — leave empty to hide
  },
} as const;

export type NavLink = { label: string; href: string };

export const navLinks: NavLink[] = [
  { label: "Tools", href: "#contribution" },
  { label: "Pool", href: "#pool" },
  { label: "Blog", href: "/blog" },
];
