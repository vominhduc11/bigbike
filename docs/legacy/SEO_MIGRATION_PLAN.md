# SEO Migration Plan

Phase: 2 - Contract normalization

This plan is based only on sanitized legacy discovery in `docs/legacy`. It does not include raw redirect rows, raw SQL, raw WordPress source, order keys, customer data, user data, email, phone, address, password hashes, sessions, tokens, API keys, or secrets.

## 1. Goals

- Preserve existing SEO value during rebuild.
- Keep legacy public URLs stable unless a redirect is explicitly documented.
- Define where route, redirect, canonical, metadata, and media mapping decisions live.
- Prevent accidental indexing of private/order/account URLs.
- Give future implementation agents a clear contract without requiring raw legacy inspection.

## 2. Required Inputs

Read these files before SEO-related implementation:

```text
docs/legacy/WORDPRESS_SOURCE_AUDIT.md
docs/legacy/LEGACY_DATABASE_SCHEMA.md
docs/legacy/LEGACY_ROUTE_MAP.md
docs/legacy/SEO_REDIRECT_MAP.csv
docs/legacy/WORDPRESS_TO_NEW_STACK_MAPPING.md
docs/contracts/DATA_CONTRACT.md
docs/contracts/API_CONTRACT.md
docs/business/BUSINESS_RULES.md
```

Do not read `sqldump.sql` for SEO implementation unless the task is a dedicated sanitizer pass.

## 3. URL Preservation Policy

Default policy for launch is preserve-first.

| Legacy pattern | Phase 2 policy |
|---|---|
| `/` | Preserve. |
| `/{page-slug}/` | Preserve. |
| `/san-pham/` | Preserve. |
| `/product/{product-slug}/` | Preserve. |
| `/danh-muc-san-pham/{category-slug}/` | Preserve. |
| `/tu-khoa-san-pham/{tag-slug}/` | Preserve. |
| `/brands/{brand-slug}/` | Preserve after live verification. |
| `/tin-tuc/{post-slug}.html` | Preserve unless business approves clean blog URLs. |
| `/category/{category-slug}/` | Preserve or redirect after crawl verification. |
| `/?s={query}` | Preserve compatibility. |
| `/gio-hang/`, `/thanh-toan/`, `/tai-khoan/` | Preserve route behavior, apply noindex where appropriate. |

Any route change requires updating `SEO_REDIRECT_MAP.csv` in the same change.

## 4. Redirect Contract

Redirect source of truth during migration:

```text
docs/legacy/SEO_REDIRECT_MAP.csv
```

CSV columns:

```text
source_pattern,target_pattern,redirect_type,status,notes
```

Rules:

- Use `preserve` when route stays unchanged.
- Use `301` only when a permanent target is approved.
- Use `302` only for temporary rollout/testing behavior.
- Use `410` only when content is intentionally retired and business approves.
- Use `noindex` for pages that should render but not be indexed.
- Never add real order keys, user identifiers, customer identifiers, or query values containing PII.

Known raw legacy redirect sources exist but were not extracted:

- Rank Math redirection tables.
- `fg_redirect` table.

Those tables require a dedicated sanitizer pass before any row-level redirect map can be committed.

## 5. Canonical Rules

- Canonical product URL should use `/product/{product-slug}/`.
- Canonical category URL should use `/danh-muc-san-pham/{category-slug}/`.
- Canonical product tag URL should use `/tu-khoa-san-pham/{tag-slug}/` if product tags remain public.
- Canonical brand URL should use `/brands/{brand-slug}/` only after live verification.
- Canonical article URL should keep `/tin-tuc/{post-slug}.html` until a redirect plan changes it.
- Search results should generally not be canonicalized as content pages unless explicitly approved.
- Filtered listing URLs with `minPrice`, `maxPrice`, `brandSlug`, `gender`, `color`, or pagination need canonical/noindex rules before implementation.

## 6. Metadata Mapping

Legacy SEO sources:

- Rank Math is active.
- Historical Yoast metadata exists.
- Theme code customizes product/category/shop title and description based on filters.
- Product/category/page custom fields provide content and hero data.

New-stack metadata contract:

- Products, categories, brands, articles, pages, and campaigns use `SeoMeta` from `DATA_CONTRACT.md`.
- Missing SEO title may fall back to resource name/title.
- Missing SEO description may fall back to excerpt/description.
- Filter-derived SEO titles must be deterministic and must not create spammy pages.
- Robots/noindex must be explicit in data or route config.

## 7. Media Path Mapping

Legacy media references may point under:

```text
wp-content/uploads
```

New storage contract:

```text
legacy relative path -> storage key -> public CDN/storage URL
```

Rules:

- Public pages must render only new public media URLs.
- Do not expose local file paths or raw WordPress filesystem paths.
- Do not commit raw upload binaries as part of SEO contract work.
- Preserve image alt text when sanitized.
- Redirecting old image URLs is recommended if legacy image URLs are indexed or externally linked.

## 8. Indexing Policy

Should be indexable:

- Homepage.
- Published product pages.
- Published product category pages.
- Verified brand pages.
- Published article/news pages.
- Important static/policy/guide pages.

Should be noindex or blocked from indexing:

- Cart.
- Checkout.
- Order received / thank-you URLs.
- Account pages.
- Login/register/recovery pages.
- Admin.
- API routes.
- Internal migration/audit pages.
- Search/filter pages unless explicitly approved for SEO landing strategy.

## 9. Internal Link Rules

- Navigation, breadcrumbs, product cards, category cards, brand links, and article links must use canonical routes.
- Do not generate internal links to raw WordPress URLs after migration.
- Any internal link route change must update `SEO_REDIRECT_MAP.csv`.
- Product search should support legacy `/?s={query}` compatibility.

## 10. Launch Checklist

- [ ] `SEO_REDIRECT_MAP.csv` covers every intentional URL change.
- [ ] Legacy preserve routes are implemented or routed to equivalent pages.
- [ ] Product/category/brand/article/page canonical URLs are stable.
- [ ] Cart/checkout/account/order received are noindex where appropriate.
- [ ] Sitemap includes only indexable public routes.
- [ ] Robots rules do not block important product/category/article pages.
- [ ] Old media URLs either resolve or redirect if needed.
- [ ] Metadata exists or has safe fallback for public resources.
- [ ] No real order keys, customer identifiers, emails, phones, addresses, or secrets appear in generated SEO artifacts.

## 11. Open Questions

- Should `/brands/{brand-slug}/` be kept, or does production use another brand base?
- Should `/tin-tuc/{post-slug}.html` be permanent, or should news migrate to clean URLs?
- Should product tag pages remain indexable?
- Which filtered listing combinations are allowed to be indexable SEO landing pages?
- Will redirects be implemented in app middleware, backend, CDN/edge, hosting config, or a generated static map?
- Should old `wp-content/uploads` media URLs redirect to new storage URLs?
