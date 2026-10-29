# Homepage polish references and reproduction

The Editorial homepage and shared navigation/footer are implemented on the clean
application lineage starting at `8bc3eb713c26db54a8eaf2b6bee7580ef303ac2f`, using
Node.js 24.22.1. The package manifest and lockfile are unchanged by homepage polish.
This stage supplies the homepage and shared presentation; supporting destinations
are the immediate next change, and complete visitor journeys remain to be checked.

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

The active work is the Editorial homepage and its project, About and Blog
journeys, with the four independent project identities and explicit Cardano Dev
Skills creator/handover credit. Pool content in this stage must be read-only,
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
and framed as captures. Four project cards link to the agreed in-hub routes;
those route implementations are delivered by the immediate supporting-pages
change. This intermediate homepage commit does not establish those journeys.

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
No article cards have links, publication dates or article bodies. Supporting-page
journeys, composed keyboard/200% text review, live data, wallet work and release
verification remain outstanding beyond this homepage stage.
