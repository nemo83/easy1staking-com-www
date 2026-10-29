# Homepage polish references and reproduction

The Editorial homepage and supporting pages are implemented on
`feat/homepage-polish`. The application at
`1ce8befcb17b872bc75e0d58d0ea424d8cb63db1` was independently verified using
Node.js 24.22.1. Its clean application lineage starts at
`8bc3eb713c26db54a8eaf2b6bee7580ef303ac2f`; that earlier baseline alone still has
the older layout. Use a checkout containing the implemented homepage commit.
The package manifest and lockfile are unchanged by homepage polish.
This stage supplies the homepage, shared presentation, four project overviews,
About, a Coming soon Blog and a read-only Pool destination. Composed browser,
accessibility and visitor-journey verification is complete within the preview
scope described below.

The reviewed product references are:

- [SPEC.md](../SPEC.md) and [LAYOUT.md](../LAYOUT.md): the broader product
  specification and component plan.
- [Brand direction](brand-direction.json), [product catalogue](brand-research/product-catalog.json)
  and [pool identity evidence](brand-research/pool-identity-evidence.json).
- [Editorial previews](brand-research/homepage-previews/index.html), their desktop
  and mobile images, and [capture provenance](brand-research/homepage-previews/capture-provenance.json).
  These are historical design references, including simulated interactions.
- [Connected Soft media gallery](../easy1staking/public/brand/index.html), its
  downloadable ZIP, assets and font licence.
- [Official product logos](brand-research/logos/) and
  [public project imagery](../easy1staking/public/images/projects/).

These references and media were recovered as exact bytes from historical commit
`b76886e6e91f8e90e3c381d05eb52dec88209d93`. That commit supplies reference data
only. Use the clean application source above for all installation, build and
runtime commands; historical startup guidance is not reproduction guidance.
Original SVG and font-licence whitespace is retained to preserve the reviewed
asset bytes.

This stage includes the Editorial homepage and its project, About and Blog
journeys, with the four independent project identities and explicit Cardano Dev
Skills creator/handover credit. Pool content in this stage is read-only,
with unavailable delegation and live pool facts stated visibly before navigation
and on `/pool`. In-site wallet connection, transactions and live pool data are
separate follow-up work. The broader specification describes later behavior and
does not make those features part of this polish stage.

All three writing cards remain **Coming soon**, without publication dates,
article bodies or article destinations:

- From stake pool operator to Cardano developer
- A real debugging walkthrough using uplc.link
- Inside AdaMatic

From a clean checkout containing these changes, use Node.js
24.22.1 and run these commands from `easy1staking/` with stdin closed for
unattended checks:

```sh
npm ci </dev/null
npm run build </dev/null
npm run lint </dev/null
```

The install needs npm registry access. Typography is served locally: the delivered
Poppins SemiBold font (with its existing OFL licence), Georgia emphasis and system
sans-serif body text. Building this homepage does not need Google Fonts access.
No Blockfrost project identifier or API key is required for these checks. A successful build must produce `.next/BUILD_ID` and route
manifests; lint must actually run without an interactive setup prompt. The
homepage is statically generated; its home/shared import graph has no wallet, SDK
or pool-provider dependency.

For local or LAN review, run the built application from the same directory:

```sh
npm run start -- --hostname 0.0.0.0 --port 3000
```

This is review guidance only. Public release, deployment, live pool claims and
wallet/delegation readiness require their own completed verification.


## Implemented homepage and shared presentation

The selected Editorial composition uses the delivered Connected Soft lockups, a
split E1/project-connections hero, two-column desktop project grid and the approved
projects → pool → Giovanni → writing section order. Website captures are labelled
and framed as captures. Four project cards open their matching in-hub overviews. Each overview explains
the project and Giovanni’s role before linking to its independent destination.

The header has a home logo, Projects, Pool, About and Blog destinations, a visible
read-only delegation qualification beside its pool action, and a mobile disclosure
with selection/Escape closure and focus return. A skip link targets `main-content`.
The footer links only to confirmed X/GitHub destinations and delivered brand media.
External social links announce opening a new tab. Reduced motion disables
transitions and smooth scrolling. The page uses flexible layouts rather than
hiding horizontal overflow.

`src/lib/site/editorial.ts` supplies `editorialProjects`, `upcomingArticles`,
`editorialSocials`, `easy1PoolId` and `poolPreviewNotice`. Each typed project includes
its slug, summary, role, onward URL, optional source URL, official icon, actual
capture and short feature list. `EditorialSections.tsx` exports `ProjectCard`,
`UpcomingArticleGrid`, `UnavailablePoolFacts`, `GiovanniPortrait` and `ExternalLink`
for reuse by supporting pages. Cardano Dev Skills explicitly credits Giovanni's
origin/handover to the Cardano Foundation. AdaMatic distinguishes current HOSKY
auto-pulls from roadmap recurring ADA payments.

The supplied portrait is horizontally flipped and resized to a 1200 × 1200 WebP
(154,048 bytes), without generative changes. The original image is unchanged.
Source SHA-256: `678563d558ac9f9cf9a7bfb81ff6a6d800db829f721dffab42cb3b28117a4cf0`.
Derived SHA-256: `d4e5e7145871c81bd80a5a1d1ff99a43243b2c47b3fc05df87ed6ec0486e5697`.
It has meaningful alternative text and explicit dimensions.

The home and shared shell do not import the inherited delegation panel or live
pool strip. Pool facts are em dashes with an explicit unavailable explanation;
wallet connection, in-site delegation and live pool data remain separate work.
No article cards have links, publication dates or article bodies. Keyboard and
enlarged-text review is complete for this stage. Live data, wallet work,
old-route migration and release verification remain follow-up work.


## Supporting visitor destinations

The statically generated project routes are `/projects/adawatch`,
`/projects/adamatic`, `/projects/uplc-link` and `/projects/cardano-dev-skills`.
The route awaits Next.js 15 parameters and uses an exact catalogue lookup;
`generateStaticParams` lists the four known slugs and `dynamicParams = false`
prevents other slugs from generating pages. Unknown project slugs and the
unpublished `/article-layout` path return HTTP 404 with the custom EASY1 error
page and useful home/projects links.

`OverviewPage.tsx` shares the approved split hero, framed real product capture,
feature explanation, authorship section and quiet Pool invitation. Detail copy
is typed in `projectOverviews` beside the shared project catalogue.
AdaWatch explains that its website introduces the bot. AdaMatic labels HOSKY
auto-pulls as available and recurring ADA payments as roadmap work. Cardano Dev
Skills credits Giovanni’s origin and Foundation handover before the official
website/repository links. Every external link announces its new tab.

`/about` uses the real optimized portrait and confirmed 2020 → building → sharing
journey. `/blog` reuses the same three Coming soon cards as the homepage.
`/pool` prominently says **Pool information preview**, explains that delegation,
wallet connection and live data are unavailable, shows unknown facts and the
verified EASY1 pool ID, and links back to the projects and story. It has no wallet
controls, disabled transaction demonstration or data requests. These supporting
pages share the Editorial main/skip target and scoped `EditorialPages.module.css`.
Each known destination has its own title, canonical and Open Graph URL.

Build and lint passed under Node.js 24.22.1 using the existing locked dependencies,
with no public Blockfrost configuration. The production manifest contains the
seven supporting paths and no fallback for unknown project slugs. The built
application returned 200 for all seven paths and 404 for unknown, prototype-like
project names and `/article-layout`. Browser verification checked loaded images,
page titles/canonicals/Open Graph URLs, one H1 and the common skip target, plus
representative AdaWatch/About screenshots at 1440px and 390px. The inherited
scooper route remains outside this change and still requires the separate
migration work.

## Completed preview verification

An independent clean install, production build and lint passed on Node.js
24.22.1. All 273 browser acceptance checks passed against a separately built
production artifact, covering the eight visitor routes at 360, 390, 768 and
1440px, loaded real media, internal destinations, project/article 404 behavior,
mobile menu selection/Escape/focus, keyboard skip navigation, reduced motion and
read-only Pool safeguards. All eight routes have the required Open Graph
properties and correct canonical URL identities.

Automated accessibility scans had no violations. Manual follow-up resolved
gradient contrast cases and verified semantic unavailable values. Enlarged-text
checks doubled computed font sizes and line heights; native browser zoom and
native screen-reader testing are not claimed. The genuine portrait and approved
desktop/mobile composition were also visually inspected.

This completes the homepage preview scope. It does not establish public release,
live pool data, wallet/delegation readiness or dependency security clearance.
Existing dependency audit findings require release review. No publication or
deployment is implied by this guide.
