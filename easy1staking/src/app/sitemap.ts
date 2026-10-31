import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/about", "/blog", "/pool", "/projects/adawatch", "/projects/adamatic", "/projects/uplc-link", "/projects/cardano-dev-skills"]
    .map(path => ({ url: `https://easy1staking.com${path}` }));
}
