# YorpHives Headquarters — automatic tool discovery and comparison review

**Development status: feature branch / draft PR #4.** Deployed Headquarters is read-only; the founder alone can approve source-code or infrastructure changes.

## What this implementation does

Headquarters inventories public YorpHives tool URLs from the deployed site, without depending on GitHub repository access:

1. Prefer the public owner-owned `/.well-known/yorphives-products.json` catalog.
2. Read public `robots.txt`, `sitemap.xml`, `sitemap_index.xml` and up to four same-origin sitemap entries.
3. Examine the homepage and known tool hubs for same-origin tool hyperlinks and JSON-LD application descriptions.
4. Inspect **at most one** same-origin public JavaScript bundle for literal tool-route hints; they remain **candidates**, never proven tools. Scripts are read as text, never executed.
5. Enroll the resulting URLs into the **dedicated HQ D1 database only**. Do not write to the website, GitHub, Pages or production configurations.
6. The existing hourly passive monitor automatically checks up to four least-recently-checked enrolled tools. For generic SPA shells, report unverified functionality even if GET returns HTTP 200.
7. Compare stable public page titles/headings/descriptions to identify possible page revisions. Do not infer that product functionality changed.
8. Research free public product mentions. A name match can create a *potential alternative* for an existing product; no real feature gap, customer traffic or revenue is claimed without evidence.

All external calls are restricted to allowlisted **public GET** URLs. Redirects are never followed automatically. Cloudflare Access remains founder-only, with signed-session/identity verification. The strict **900 public GETs/day** shared ceiling remains unchanged.

## Actual source-of-truth caveat

Cloudflare Pages production `yorphives` currently references an older GitHub source project `solopreneursid/YorpHives` that is not accessible via the connected GitHub account. The separate `solopreneursid/YorpHives_Website` repository currently contains only `LICENSE`. Neither represents a reliable current product inventory.

Accordingly, **the deployed website's public responses** are the evidence source, not repository search. Previously recorded discovery returned `partial:no-discoverable-tool-routes`. This is not proof that YorpHives has zero tools.

## Optional future website manifest — not deployed

For truly reliable automatic enrollment of arbitrary SPA or vanity-route tools, the founder can separately approve publishing this file **on the website**:

```json
{
  "complete": true,
  "products": [
    {
      "url": "/tools/example-image-resizer",
      "name": "Example Image Resizer",
      "features": ["Batch resizing", "JPEG and PNG"]
    },
    {
      "url": "/example-pdf-converter",
      "name": "Example PDF Converter",
      "features": ["PDF export"]
    }
  ]
}
```

The URLs above are **illustrative**, not discovered YorpHives products. `complete:true` must be present and every listed route valid, unique and within the scanner's bounded catalog to mark the inventory complete. Otherwise the report remains **partial**. Missing entries in a sitemap are never treated as proof of removal.

## Confidence model

| Evidence source | Classification | What it proves |
| --- | --- | --- |
| Owner public manifest | `published` | A product is declared in the public catalog; features are declarations only. |
| Sitemap / visible link / JSON-LD | `published` | A route was published or linked; functionality is still unverified. |
| Literal string in public JavaScript | `candidate` | A route might exist; dead code or examples are possible. |
| HTTP 200 for generic SPA shell | `unverified` | The site returned a page, **not** evidence that the tool works. |
| Public RSS title similar to a tool | `unverified alternative` | Possible topic overlap, **not** feature inferiority or real market demand. |

## Database migration and verification

New HQ-only database migration: `cloudflare/migrations/0003_catalog_evidence.sql`.

Adds source/confidence/evidence and public-page metadata fields to HQ `assets`, plus `product_hypotheses` for matching public product mentions. This must be applied to the **separate Headquarters D1**, never the website's database.

Tests:
- Strict source, host, scheme, admin-path and completeness checks.
- Sitemap index, public JSON-LD, bounded JavaScript candidate extraction.
- Simulated two releases of a manifest, automatic enrollment, next-hour checking and audit trail.
- Mocked public GET only, no redirects, no website writes, no paid AI/browsers.
- SQLite-compatible migration tests, existing UI regression tests, founder-only Access regression tests.

The upgraded discovery engine has a one-time versioned scan at its first normal five-minute Cron after deployment, then the normal six-hour cadence. It does **not** create a remotely callable admin or scan-trigger API.

## Remaining limitations

A website with all tool definitions hidden behind large minified JavaScript or runtime API calls cannot be fully and reliably inventoried using bounded passive HTTP alone. Public tool manifest or server-rendered tool links remain necessary for full coverage. No commercial competitor-traffic analytics, full feature-functionality test or verified revenue intelligence is claimed. The same fixed free-tier resources and founder-only permissions remain in place.
