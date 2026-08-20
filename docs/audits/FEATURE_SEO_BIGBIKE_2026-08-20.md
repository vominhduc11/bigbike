# BigBike SEO audit — verification and remediation

Date: 2026-08-20  
Scope: `bigbike.vn`, Google Sheet tab `3xx Status Code` (`gid=261054131`), BigBike URLs only.  
Runtime checked: `bigbike-web:3000`, `bigbike-backend:8080`, PostgreSQL `bigbike-postgres`.

Source filtering: the spreadsheet is `Website Audit - bigbike`; only tab `3xx Status Code`
(`gid=261054131`, range `A1:J68`) was used for the redirect table. Its 67 data rows all start
with `https://bigbike.vn/`. Rows/tabs containing `hydrinity.com.vn`, `citrinedermaclinic.vn`
or `ondigitals.com` were excluded. The separate current `Empty meta description` tab contained
41 BigBike URLs and was checked independently.

## Phase 1 — verification before mutation

No tracked source or live database data was changed during verification.

| Item | Audit claim | Current evidence | Verdict |
|---|---|---|---|
| 1 | 169 product descriptions contain HTML; 151 exceed 165 chars; reuse on 8–10 products | 177 published products / 354 locale variants: 124 effective meta descriptions contain HTML, 141 raw values exceed 165 chars, 95 visible text values exceed 165 chars, and one duplicate group contains 2 products. Quadlock still renders a 458-character `data-component` value; Taichi RSX158 still renders HTML. ILM BS3 currently returns 404. | Partly correct |
| 2 | Main helmet menu item uses a legacy category URL | Active menu item renders `/danh-muc/mu-bao-hiem-3-4/`; the route returns 200 and is present in live home HTML. | False |
| 3 | 176 dead in-article links plus 12 broken images | The three named `.html` links occur 0 times in current published `body`/`body_blocks`; the current Broken links sheet has no BigBike rows. Seven broken image URLs remain in three published articles: five BigBike 404s, one Motogear 403 and one Motoworld 404. | Partly correct |
| 4 | Three English product redirect loops | Six sheet rows reproduce three loops: ILM M1006, Komine BK-300 and Komine JK-1143. | Correct |
| 5 | 12 articles / 24 URLs show `%title%` | 13 published articles / 26 VI+EN URLs currently show the placeholder, including the 12 listed by the audit plus `cach-gan-camera-hanh-trinh-len-mu-bao-hiem`. | Partly correct |
| 6 | 41 URLs have empty title and description | All 41 live URLs return 200 and have a rendered title fallback; 35 have an empty meta description and 6 already have one. The set contains 8 brand URLs, 6 price-filter URLs and 27 article/other URLs. | Partly correct |
| 7 | 132 English/Vietnamese metadata pairs are identical | There are 406 current VI/EN pairs: 211 same titles, 173 same descriptions and 170 same both. Of 268 EN pairs meeting `SEO_RULE_002`, 78/58/55 respectively remain identical. Shared brand names are intentionally not translated. Owner chose manual localization of the English metadata. | Partly correct |
| 8 | Eight redirect rows take two hops; the other 59 are correct | Eight rows reach a final 200 only after two redirects. Six additional rows are the three loops from item 4; 53 rows are currently direct and correct. | Partly correct |

The seven broken image URLs verified before repair were:

- `https://bigbike.vn/media/wysiwyg/Jackets/22554718_953697174782112_6002009237971976472_n.jpg`
- `https://bigbike.vn/media/wysiwyg/Jackets/22729143_953697218115441_5895811918445629260_n.jpg`
- `https://bigbike.vn/media/wysiwyg/Jackets/Cj_ahdCUkAEx5XJ.jpg`
- `https://bigbike.vn/media/wysiwyg/ao-bao-ho-taichi-rsjj19-red.jpg`
- `https://bigbike.vn/media/wysiwyg/ao_bao_ho_taichi_rsj710_trang.JPG`
- `https://www.motogear.my/image/cache/catalog/rs-taichi/RSJJ19/image4-700x700.jpg`
- `https://www.motoworld.com.sg/image/cache/data/other/RS%20Taichi/RSJJ19/image3-800x800-0.jpg`

Redirect evidence from the 67-row tab:

- Loop pairs: `/en/product/ilm-m1006-touring-motorcycle-boots/` ↔
  `/en/product/ilm-m1006/`; `/en/product/giay-moto-touring-komine-bk-300/` ↔
  `/en/product/komine-bk-300-touring-motorcycle-boots/`; and
  `/en/product/ao-giap-moto-nu-mua-he-komine-jk-1143/` ↔
  `/en/product/komine-jk-1143-lady-summer-motorcycle-jacket/`.
- Two-hop category sources: `/en/categories/quan-ao-bao-ho-moto/`, the same path with
  `?manufacturer=7`, the same path with `?manufacturer=29`, `/en/categories/giay-bao-ho/`,
  `/en/categories/non-bao-hiem-moto/`, `/en/categories/gang-tay/`, and
  `/en/categories/giap-bao-ho-tay-chan-dai-lung-phu-kien-giap/?manufacturer=9`.
- Two-hop product source: `/en/product/ba-lo-moto-phuot-givi-15-lit-ea129b/`.

For item 6, the six URLs that were not empty at runtime were
`/brands/xpeed/?min_price=5000000&max_price=10000000` (33 characters),
`/brands/scs/?min_price=3000000&max_price=5000000` (452 characters of HTML),
`/danh-muc/ao-quan-bao-ho/?manufacturer=7` (129),
`/danh-muc/gang-tay-touring/?min_price=5000000&max_price=10000000` (35),
`/danh-muc/mu-bao-hiem-3-4/?min_price=500000&max_price=1000000` (131), and
`/brands/xpeed/?min_price=0&max_price=500000` (33). The remaining 35 of the 41 had no
description metadata in the rendered response.

## Scope decisions

- Item 2 remains unchanged because the current menu is already correct.
- The dead-link portion of item 3 remains unchanged because no named dead links exist in current content.
- Broken images are removed rather than hotlinked or guessed-replaced, per owner decision.
- English SEO metadata is manually localized, per owner decision; shared brand names remain shared.

## Phase 2 — remediation implemented in the repository

The source changes and versioned migrations are implemented and have now been applied to the
running PostgreSQL instance through the requested VPS compose deployment. The deployment also
cleared the web redirect cache after the target correction.

Read-only confirmation from `bigbike-postgres` shows `V1041`, `V1042` and `V1043` applied.
The backend migration log reported 97 product rows, 6 category rows, 26 brand rows and 89
article rows changed by `V1041`, with 14 stored broken-image references removed.

| Item | Implemented change | Scope / expected effect | Current status |
|---|---|---|---|
| 1 | `V1041` normalizes existing SEO fields to plain text, removes the known chat-widget markup from fallback values, truncates descriptions at 165 characters, and repairs the admin/web write-and-render paths. | Scans 177 published products / 354 locale variants; also enforces the rule for categories, brands and articles. | Deployed; DB spot check shows 0 product SEO descriptions with HTML and 0 over 165 characters. |
| 2 | No change. | The active menu already points directly to `/danh-muc/mu-bao-hiem-3-4/` and returns 200. | Intentionally unchanged. |
| 3 | No link rewrite. `V1041` removes only the seven exact broken image URLs listed in Phase 1 from both article HTML and structured blocks. | Three articles; no external replacement is introduced. | Deployed; exact seven URL patterns remaining in published content: 0. |
| 4 | `V1042` disables the three verified neutral product aliases that caused the loops. | ILM M1006, Komine BK-300 and Komine JK-1143 keep one canonical English route; the product route handles the one-way locale canonicalization. | Deployed; all tested product sources now finish 200 without a loop. |
| 5 | `V1041` supplies English titles/descriptions for the 13 published placeholder articles and replaces the Vietnamese `%title%` placeholders. | 13 article records / 26 VI+EN URLs, including the audit's 12 plus `cach-gan-camera-hanh-trinh-len-mu-bao-hiem`. | Deployed; DB spot check shows 0 published article placeholders. |
| 6 | `V1041` backfills/cleans metadata for the identified brand/article pages. Web category/brand pages with `min_price` or `max_price` remain 200 but emit `noindex, follow`, canonicalize to the base page, and omit hreflang. | 41 audit URLs remain customer-accessible; six price-filter URLs receive the noindex policy. | Deployed; redirect/metadata spot checks passed; full 41-URL recrawl remains recommended. |
| 7 | Existing genuine English metadata is retained, duplicate English SEO fields are replaced from available English content, and explicit English copy is supplied for the 13 article placeholders and four empty brand pages. Shared brand names remain shared by contract. | The owner-approved direction is localization. No invented translation is generated for an entity that has no English source; those pages remain governed by the existing English-index eligibility rule until editorial copy is supplied. | Partially automated; remaining editorial localization is a business-content backlog. |
| 8 | `V1042` adds six exact English-source redirect rules (five category aliases and Givi EA129B); `V1043` corrects the Givi target to the published slug `/en/product/givi-ea129b-motorcycle-backpack/` after live verification. | Eight two-hop rows are covered when combined with the three loop repairs in item 4; the 53 already-direct rows are untouched. | Deployed and rechecked. |

## Verification after implementation

Passing focused checks:

- Backend: `AdminMutationValidatorsTest`, `SeoTextNormalizerTest`.
- Web: metadata normalization/robots, price-filter detection and locale redirect tests — 49 tests.
- Admin: SEO schema plus content SEO screen tests — 35 tests.
- Web and admin lint, plus `git diff --check`.

Full-suite checks were also run for context. The current web suite ended with 13 failures / 472
tests and the admin suite with 31 failures / 903 tests, primarily 5-second UI/i18n timeouts and
unrelated screen assertions; none was in the focused SEO tests. A pre-change baseline was not
run, so these are not labeled as regressions. The backend suite
ran 1,404 tests with 0 failures, 1 skipped test and 3 errors: `AdminReportRepositoryQueryTest`,
`CatalogPostgresQueryTest` and `VariantSkuConflictTest` could not fetch the Testcontainers
`postgres:16-alpine` image because the test process could not initialize a Docker environment.

## Post-deployment recheck

The requested deployment is complete. All eight two-hop sources were checked locally and each
now reaches a 200 English canonical page in one redirect; the Givi source reaches
`/en/product/givi-ea129b-motorcycle-backpack/`. The three loop families were also checked and no
longer loop. A full recrawl of all 41 metadata URLs and a fresh English duplicate-metadata count
should still be recorded before closing the audit in Google Search Console.
