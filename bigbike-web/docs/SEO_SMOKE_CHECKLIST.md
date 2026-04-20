# SEO Smoke Checklist (Phase 4C)

Use this checklist after `npm run build` or before release.

## 1) Canonical URL

- [ ] Home page has canonical `https://bigbike.vn/`
- [ ] Product listing canonical is `https://bigbike.vn/san-pham/`
- [ ] Product detail canonical is `https://bigbike.vn/product/{slug}/`
- [ ] Category listing canonical is `https://bigbike.vn/danh-muc-san-pham/`
- [ ] Category detail canonical is `https://bigbike.vn/danh-muc-san-pham/{slug}/`
- [ ] Brand listing canonical is `https://bigbike.vn/brands/`
- [ ] Brand detail canonical is `https://bigbike.vn/brands/{slug}/`
- [ ] Article listing canonical is `https://bigbike.vn/tin-tuc/`
- [ ] Article detail canonical is `https://bigbike.vn/tin-tuc/{slug}.html`
- [ ] Static page canonical is `https://bigbike.vn/{page-slug}/`

## 2) Query Variants

- [ ] `/san-pham/?q=...` is marked `noindex`
- [ ] `/san-pham/?category=...` is marked `noindex`
- [ ] `/danh-muc-san-pham/?page=2` is marked `noindex`
- [ ] `/brands/?sort=...` is marked `noindex`
- [ ] `/tin-tuc/?q=...` is marked `noindex`

## 3) Route Preservation

- [ ] `/san-pham/` works
- [ ] `/product/{slug}/` works
- [ ] `/danh-muc-san-pham/{slug}/` works
- [ ] `/brands/{slug}/` works
- [ ] `/tin-tuc/{slug}.html` works
- [ ] `/{page-slug}/` works for published pages

## 4) Trailing Slash

- [ ] Non-file public routes are normalized to trailing slash
- [ ] `.html` article route keeps no trailing slash (`/tin-tuc/{slug}.html`)

## 5) Redirect/Headers from CSV

- [ ] Redirect rules load from `../docs/legacy/SEO_REDIRECT_MAP.csv`
- [ ] `noindex` rows from CSV apply `X-Robots-Tag: noindex, nofollow`
- [ ] If CSV has no 301/302 rows, release note includes infra TODO for CDN/nginx redirect ownership

