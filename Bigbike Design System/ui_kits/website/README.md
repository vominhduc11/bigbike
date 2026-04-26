# BigBike Website — UI Kit

Interactive recreation of the Bigbike.vn storefront, built as a cosmetic-fidelity click-through prototype. **Not production code** — API calls are mocked, cart is in-memory.

## Files

| File | Purpose |
|---|---|
| `index.html` | Entry. Wires up navigation between Home, Catalog, PDP. |
| `styles.css` | `wp-*` stylesheet (sticky header, hero, product card, PDP, footer). |
| `data.js` | Sample products, brands, categories, hero slides, articles + `formatVnd()`. |
| `SharedComponents.jsx` | Icons, `<SiteHeader>`, `<SiteFooter>`, `<PromoStrip>`, `<ProductCard>`, `<Toast>`, `<FloatingChat>`. |
| `HomePage.jsx` | `<HeroSlider>`, `<FeatureRow>`, `<CategoryGrid>`, `<FeaturedProducts>`, `<PromoBanner>`, `<AboutBlock>`, `<LatestArticles>`, `<BrandStrip>`. |
| `CatalogPage.jsx` | Filters sidebar + sortable product grid + breadcrumb. |
| `ProductDetailPage.jsx` | Gallery + thumbs, variant/size chips, quantity stepper, add-to-cart, related. |

## Interactions wired

- Nav between Trang chủ → Sản phẩm → Chi tiết sản phẩm.
- Click any product card → PDP.
- Add to cart → toast + cart badge increments.
- Hero slider auto-advances every 6s; dots click to jump.
- Catalog: brand checkboxes filter, sort dropdown reorders, clear-filter link.
- PDP: color + size chips, qty stepper, add-to-cart.

## Sources referenced

Everything pulled from the Next.js codebase:
- `components/layout/SiteHeader.tsx` — trapezoid logo panel, red bullet separators, icon buttons.
- `components/catalog/ProductCard.tsx` — brand/category meta, Vietnamese stock labels.
- `components/home/HeroSlider.tsx`, `FeaturedProductsCarousel.tsx`, `BrandCarousel.tsx`.
- `components/layout/SiteFooter.tsx` — 4-column grid.
- `styles/brand-tokens.css` → flattened into `colors_and_type.css`.
- `app/page.tsx` — hero/about/product section copy.

## Caveats

- Product images are placeholder typographic blocks (`HELMET`, `JACKET`). Swap with real photography when available.
- Only 3 screens built; other pages (cart, checkout, account, article detail) would be the next iteration.
- All copy is Vietnamese to match the production site.
