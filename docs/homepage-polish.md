# Homepage polish references and reproduction

The homepage polish work starts from clean application commit
`8bc3eb713c26db54a8eaf2b6bee7580ef303ac2f`, using Node.js 24.22.1. The
application, package manifest and lockfile are unchanged by this reference
recovery. The recovered material does not establish that the final pages or
staking behavior have been implemented.

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

From a clean checkout containing the application source above, use Node.js
24.22.1 and run these commands from `easy1staking/` with stdin closed for
unattended checks:

```sh
npm ci </dev/null
npm run build </dev/null
npm run lint </dev/null
```

The install needs npm registry access, and the build may need Google Fonts
access. No Blockfrost project identifier or API key is required for these
baseline checks. A successful build must produce `.next/BUILD_ID` and route
manifests; lint must actually run without an interactive setup prompt. The
baseline application still has its existing layout at this recovery stage.

For local or LAN review, run the built application from the same directory:

```sh
npm run start -- --hostname 0.0.0.0 --port 3000
```

This is review guidance only. Public release, deployment, live pool claims and
wallet/delegation readiness require their own completed verification.
