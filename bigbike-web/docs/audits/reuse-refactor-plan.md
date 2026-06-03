# Bigbike-web — Phân tích tái sử dụng & Action Plan Refactor

> Quét: `components/` (99 files), `app/` (85 files), `lib/` (41 files). Mọi path & dòng đều đã verify trên code thực tế.
> Lưu ý cấu trúc: KHÔNG có thư mục `hooks/`, `utils/`, `constants/` ở top-level — hooks nằm ở `lib/hooks/`, utils ở `lib/utils/`, còn **constants thì chưa được tách module** (đang rải rác inline).

---

## 1. HIGH — Ưu tiên xử lý trước

| Mức độ | File(s) liên quan | Vấn đề | Action cụ thể |
|--------|-------------------|--------|---------------|
| High | `home/HomeVideoCarousel.tsx`, `home/FeaturedProductsCarousel.tsx`, `home/ExperienceCarousel.tsx`, `home/BrandCarousel.tsx`, `content/ArticleCarousel.tsx`, `catalog/PdpRelatedProductsCarousel.tsx` | 6 carousel, không có base chung. 4 cái re-instantiate `<Swiper>` với props gần giống hệt + nút prev/next + dots riêng (~40–60 dòng scaffolding/ file); 2 cái hand-roll lại bằng CSS transform. | Tạo `components/shared/Carousel.tsx` (wrapper nhận `items`, `renderItem`, `breakpoints`, `showArrows`, `showDots`) + `components/shared/CarouselControls.tsx` (arrow/dot). Migrate cả 6. |
| High | `home/HomeVideoCarousel.tsx`, `home/FeaturedProductsCarousel.tsx`, `catalog/PdpRelatedProductsCarousel.tsx` | Logic "slides-per-view theo width": hàm bucket `if (w>=N) return X` + `useState` + `useEffect`+`resize listener`+cleanup copy-paste 3 lần, chỉ khác con số breakpoint. | Extract `lib/hooks/useResponsiveValue.ts` (hoặc `useSlidesPerView`). Xoá 3 bản inline. |
| High | 11 files: `catalog/MobilePdpAnchorNav`, `catalog/MobileStickyPurchaseBar`, `catalog/ProductGallery`, `layout/MobileHeaderMenu`, `layout/SearchToggle`, `layout/ShopInfoDrawer`, `layout/StickyHeaderShell`, `layout/ScrollToTopButton`, `layout/HeaderUiContext`, + 2 carousel | `matchMedia` / `addEventListener("resize"\|"scroll")` + cleanup tự viết lặp lại ở 11 nơi (isMobile, sticky, close-on-breakpoint…). | Tạo `lib/hooks/useMediaQuery.ts` + `lib/hooks/useScrollPosition.ts`. Thay toàn bộ listener thủ công. |
| High | `lib/utils/format.ts` (`formatVnd` → "X đ"), `lib/utils/catalog.ts` (`formatMoney`, không suffix), `catalog/QuickBuyModal.tsx` (inline `.toLocaleString("vi-VN")` + "₫" ×5) | 3 cách format tiền VND khác nhau, **ký hiệu tiền tệ không nhất quán** (`đ` vs `₫` vs không có). | Giữ 1 hàm `formatVnd(value, {symbol})` trong `lib/utils/format.ts`. Xoá `formatMoney` ở catalog.ts, thay 5 chỗ inline trong QuickBuyModal. |
| High | `catalog/ProductCard.tsx` (`computePricing` L22-42), `catalog/PricingPanel.tsx` (L29-42), `catalog/ComparisonTable.tsx` (`priceOf` L18-25) | Logic suy ra giá sale/compare/current/discount% lặp 3 lần, mỗi nơi hơi khác → rủi ro hiển thị giá lệch nhau. | Tạo `lib/pricing.ts` → `derivePricing(price)` trả `{current, compare, isSale, discountPercent}`. Dùng ở cả 3. |
| High | `catalog/ProductCard.tsx` (L51-58), `catalog/ComparisonTable.tsx` (L48-55), `catalog/StockStatus.tsx` (L39-56) | Map trạng thái kho → label (`switch IN_STOCK/LOW_STOCK/OUT_OF_STOCK/UNKNOWN`) viết lại 3 lần. | Tạo `lib/stock.ts` → `getStockLabel(state, t)` + className map. Route ProductCard/ComparisonTable qua `StockStatus` khi layout cho phép. |
| High | `app/api/products/[id]/{pricing,snapshot,stock,variants,reviews}/route.ts` (5 handlers) | Mỗi handler lặp: block `BACKEND = env... ?? localhost:8080`, `export const dynamic`, `type Params`, cùng pattern `fetch + if(!res.ok) 4xx + catch 502`. pricing/stock/variants GET cùng `/products/${id}` chỉ khác field pluck. | Tạo `lib/api/backend-proxy.ts`: export `BACKEND`, `ProductRouteParams`, `proxyBackendJson(req, path, {transform})`, `readJsonBody()`, `readBackendError()`. Rút mỗi route còn ~10 dòng. |
| High | `app/san-pham/page.tsx`, `app/danh-muc-san-pham/[slug]/page.tsx`, `app/brands/[slug]/page.tsx` | ~60 dòng parse param catalog (page/size/brand/q/filter_color/min_price/max_price/orderby/sort + `collectErrors`) giống hệt ở cả 3. `DEFAULT_SORT`/`DEFAULT_PAGE_SIZE=24` định nghĩa lại 3 lần. | Tạo `lib/utils/catalog-params.ts` → `parseCatalogSearchParams(params)` trả `{filters, sort, orderbyCurrent, errors}`. Constants dời sang `lib/constants/catalog.ts`. |
| High | `app/san-pham/page.tsx`, `app/danh-muc-san-pham/[slug]/page.tsx`, `app/brands/[slug]/page.tsx` | Render tail giống hệt: `ProductArchiveLayout` → grid map `ProductCard variant="archive"` → `PaginationNav` + `buildQueryString({...})` + nhánh empty/error. | Tạo `components/catalog/ProductArchiveResults.tsx` nhận `result, pagination, baseHref, filters`. |
| High | `app/tin-tuc/page.tsx`, `app/tin-tuc/[slug]/page.tsx` | ~60 dòng helper WP **byte-for-byte giống nhau**: `resolveWpUploadUrl`, `normalizeKnownWpUploadUrl`, `makeSlugThumbnailFallback`, `stripHtml`, `textOrFallback` + 4 hằng WP uploads. | Tạo `lib/utils/wp-media.ts` chứa toàn bộ helper + constants + `wpDate()` + `wpExcerpt()`. Import ở cả 2. |
| High | `app/[slug]/page.tsx`, `app/chinh-sach/[slug]/page.tsx`, `app/huong-dan-mua-hang/page.tsx`, `app/lien-he/page.tsx`, `app/gioi-thieu/page.tsx` (+các trang CMS tĩnh khác, ~8 file) | Flow fetch CMS giống hệt: `getPageBySlug` + `notFound()` khi 404 + fallback `ErrorState` + `PageHero` + body `bb-richtext`. | Tạo `lib/api/static-page.ts` → `loadStaticPage(slug, locale)` + `components/layout/StaticPageShell.tsx` (hero + container + ErrorState + richtext + updatedAt). |
| High | `catalog/ProductCard.tsx` (378 dòng, 5 variant: compact/featured/tile/archive/related) | Trong cùng file, block price-fallback + `ratingValue = rating>0?rating:4.5` + `featuredImageSrc` + `<img>` fallback copy-paste qua 3 nhánh. | Extract `computeCardPricing`/`resolveCardRating` + subcomponent `ProductCardImage`. Tách variant nặng ra `ProductCardFeatured/Related/Archive.tsx`. |
| High | `layout/ShopInfoDrawer.tsx` (L80-167), `layout/MobileHeaderMenu.tsx` (L243-263) | Cả 2 tự viết drawer (overlay + slide panel + `role=dialog`) thay vì dùng `components/ui/sheet.tsx` đã có. `MenuIcon` SVG + parse hours/phones **giống hệt từng byte**. | Migrate cả 2 sang `Sheet`/`SheetContent`. Dời `MenuIcon` → `components/ui/icons.tsx`, parse hours/phones → `lib/utils/shop.ts`. |

---

## 2. MEDIUM

| Mức độ | File(s) liên quan | Vấn đề | Action cụ thể |
|--------|-------------------|--------|---------------|
| Medium | `app/san-pham/page.tsx`, `app/danh-muc-san-pham/[slug]/page.tsx`, `app/brands/[slug]/page.tsx` | `DEFAULT_SORT="createdAt:desc"` + `DEFAULT_PAGE_SIZE=24` định nghĩa lại 3 lần (cùng với `DEFAULT_WP_ORDERBY`). | Tạo `lib/constants/catalog.ts` export các hằng này + dải giá. |
| Medium | `lib/compare-storage.ts`, `lib/recently-viewed.ts`, `lib/hooks/useRecentSearches.ts` (+ `lib/compare-context.tsx`, `app/so-sanh/page.tsx`, `analytics/PurchaseEvent.tsx`, `lib/api/client-api.ts` truy cập trực tiếp) | Mỗi nơi tự lặp `typeof window === "undefined"` guard + try/catch JSON parse quanh localStorage. | Tạo `lib/utils/storage.ts` → `safeStorage.get/set<T>()` + `lib/hooks/useLocalStorage.ts`. |
| Medium | `layout/ShopInfoDrawer.tsx`, `layout/MobileHeaderMenu.tsx`, `catalog/ProductContactCta.tsx`, `home/FloatingChat.tsx`, `layout/SiteFooter.tsx` | Chuẩn hoá href `tel:` lặp ở 5 file với **3 regex khác nhau** (`/[^\d+]/g`, `/[\s.]/g`, `/[^\d]/g`) → kết quả không nhất quán. Zalo href cũng ad-hoc. | Tạo `lib/utils/contact.ts` → `telHref(raw)` + `zaloHref(raw)`. Thay 5 call site. |
| Medium | `layout/ShopInfoDrawer.tsx` (L53-62), `layout/MobileHeaderMenu.tsx` (L189-198) | Block `defaultHours` join + split/trim/filter và `phones=[hotline,hotline2].map().filter()` lặp verbatim. | Tạo `lib/utils/shop.ts` → `parseShopHours(hours, t)` + `parsePhones(...)`. |
| Medium | `home/BrandCarousel.tsx` (L12-15), `catalog/ProductCard.tsx` (L60-63) | `toLegacyWpMediaUrl(src)` định nghĩa giống hệt ở 2 file. | Dời vào `lib/utils/format.ts` (cạnh `resolveMediaUrl`). Import ở cả 2. |
| Medium | `catalog/ReviewsSection.tsx` (`StarRow` L40-60), `components/ui/RatingStars.tsx` | 2 bộ render sao độc lập (CSS overlay ★ vs 5 `<svg>` inline) cùng mục đích. | Generalize `RatingStars` thêm mode `svg`/`outline`. Xoá `StarRow`. |
| Medium | `catalog/WishlistButton.tsx` (L31-33), `catalog/CompareButton.tsx` (L72-83) | Shell nút-icon overlay trên card giống hệt (`absolute rounded-full 34px border…`), chỉ khác glyph + offset top. | Tạo `components/shared/CardIconButton.tsx` (props `active, ariaLabel, offsetIndex, children`). |
| Medium | `catalog/QuickBuyModal.tsx` (L307-330), `layout/MobileCartSheet.tsx` (L143-161) | Tự dựng control −/value/+ inline thay vì dùng `components/ui/QuantityStepper.tsx` đã có. | Thay cả 2 bằng `QuantityStepper`. |
| Medium | `app/dang-nhap/LoginForm.tsx` (2), `app/dang-ky/RegisterForm.tsx` (5), `app/quen-mat-khau/ForgotPasswordFlow.tsx` (2) | Block field RHF (`<div><Label> *<Input className="bb-auth-input" {...register}/>{error && <p…>}`) lặp 9 lần, chỉ khác name/label. | Tạo `components/ui/AuthField.tsx` (RHF-aware: `register, error, label, required`). |
| Medium | `app/dang-nhap/LoginForm.tsx`, `app/dang-ky/RegisterForm.tsx`, `app/quen-mat-khau/ForgotPasswordFlow.tsx` | Alert `errors.root` (`role=alert aria-live text-destructive`) inline + reimplement thành `RootError` — 3 bản. | Tạo `components/ui/FormRootError.tsx`. |
| Medium | `app/tai-khoan/edit-account/page.tsx`, `app/tai-khoan/edit-address/[type]/page.tsx`, `app/tai-khoan/doi-tra/page.tsx` | Banner success/error (`bg-state-success-bg border p-… mb-…` + bản danger) copy-paste 7 lần. Thêm `LEGACY_LABEL` + `ReqMark()` định nghĩa trùng. | Tạo `components/ui/FormNotice.tsx` (`tone="success"\|"danger"`) + `components/ui/AccountField.tsx`. |
| Medium | `app/tai-khoan/don-hang/page.tsx`, `app/tai-khoan/don-hang/[id]/page.tsx`, `app/tai-khoan/doi-tra/page.tsx` | Scaffold bảng order/invoice (`overflow-x-auto > table w-full border-collapse` + rows `border-b`) + dòng error `text-brand` lặp lại. | Tạo `components/account/AccountTable.tsx` + `AccountError`. |
| Medium | `app/tin-tuc/page.tsx` (`WpPagination`), `app/tim-kiem/page.tsx` (`SearchPagination`) | 2 paginator WP `page-numbers` tự viết (prev/next + thuật toán ellipsis) gần giống nhau. | Tạo `components/catalog/WpPagination.tsx` + `buildWpPageWindow(page, total)`. |
| Medium | Metadata 3 trang archive (`san-pham`, `danh-muc-san-pham/[slug]`, `brands/[slug]`) | `generateMetadata` lặp logic noIndex (`page>1 \|\| brand \|\| q \|\| color \|\| min/max \|\| orderby!==default`) + `buildCatalogTitle` cùng args. | Thêm `buildCatalogMetadata({titleBase, params, canonicalPath, seo})` vào `lib/seo/metadata.ts`. |
| Medium | Metadata 5 trang slug-detail (`[slug]`, `product/[slug]`, `danh-muc-san-pham/[slug]`, `brands/[slug]`, `tin-tuc/[slug]`) | Cùng shape `if(!isValidSlug) noIndex` → `if(!data) noIndex` — 5 bản. | Thêm `buildSlugDetailMetadata({slug, entity, invalid, notFound, build})` vào `lib/seo/metadata.ts`. |
| Medium | `catalog/PurchaseSectionClient.tsx`, `catalog/ReviewsSection.tsx`, `layout/MobileCartSheet.tsx`, `layout/SearchToggle.tsx` | Gọi `fetch()` trực tiếp, bypass `lib/api/client-api.ts` (mất CSRF/credentials/error shape tập trung). | Route qua client-api: thêm method tương ứng vào `lib/api/client-api.ts`. |
| Medium | `app/thanh-toan/page.tsx`, `app/gio-hang/page.tsx`, `app/don-hang/xac-nhan/page.tsx` | `toGtmCartItems(items)` (map `{item_id,item_name,price,quantity,currency:"VND"}`) lặp verbatim. | Extract `toGtmCartItems()` vào `lib/analytics.ts` (cả 3 đã import sẵn). |

---

## 3. LOW

| Mức độ | File(s) liên quan | Vấn đề | Action cụ thể |
|--------|-------------------|--------|---------------|
| Low | `app/tin-tuc/page.tsx`, `app/tin-tuc/[slug]/page.tsx`, `app/product/[slug]/page.tsx`, `danh-muc-san-pham/[slug]/page.tsx` | `stripHtml`/`.replace(/<[^>]+>/g," ")` để lấy plain text reimplement nhiều nơi. | Thêm `stripHtml()` / `htmlToPlainText(html, maxLen)` vào `lib/utils/html.ts`. |
| Low | `catalog/PdpRelatedProductsCarousel.tsx`, `catalog/ProductGallery.tsx`, `home/HomeVideoCarousel.tsx` (+ ShopInfoDrawer, MobileHeaderMenu) | SVG chevron/arrow/play viết path inline lẫn lộn với `lucide-react`. | Chuẩn hoá về `lucide-react` hoặc gom vào `components/ui/icons.tsx`. |
| Low | `catalog/QuickBuyModal.tsx` (L344-373) | Group radio-card phương thức thanh toán (COD/BACS) inline; pattern card chọn được còn dùng cho shipping. | Tạo `components/shared/RadioCard.tsx`. |
| Low | `catalog/QuickBuyModal.tsx` (`uuid4` L34-39) | Helper `uuid4()` idempotency-key viết inline. | Dời `lib/utils/uuid.ts` (hoặc `crypto.randomUUID`). |
| Low | `layout/MobileCartSheet.tsx` (L117-127) | Empty-cart block tự dựng thay vì `components/ui/EmptyState.tsx` đã có. | Render qua `EmptyState` (truyền icon + CTA). |
| Low | `app/gioi-thieu/page.tsx`, `app/lien-he/page.tsx` | Đọc settings contact (`pickSetting` address/hotline/facebook/zalo) + sanitize tel/url lặp. | Thêm `readContactSettings(settings)` vào `lib/utils/settings.ts`. |
| Low | `catalog/QuickBuyModal.tsx` (L275-280) | Render lỗi province/district thủ công `<p text-destructive>` bypass `FormMessage`. | Wire qua `FormField`/`FormMessage` của `components/ui/form.tsx`. |

---

## 4. Danh sách file cần tạo mới — theo thứ tự ưu tiên thực thi

**Phase 1 — Utils/constants thuần (rủi ro thấp, nền cho phần sau)**
1. `lib/constants/catalog.ts` — `DEFAULT_SORT`, `DEFAULT_PAGE_SIZE`, dải giá → thay hằng lặp ở `san-pham`, `danh-muc-san-pham/[slug]`, `brands/[slug]`, `CatalogFilters`.
2. `lib/pricing.ts` — `derivePricing()` → thay `ProductCard.computePricing`, `PricingPanel`, `ComparisonTable.priceOf`.
3. `lib/stock.ts` — `getStockLabel()` → thay map ở `ProductCard`, `ComparisonTable`, `StockStatus`.
4. `lib/utils/contact.ts` — `telHref()`, `zaloHref()` → thay 5 file contact.
5. `lib/utils/shop.ts` — `parseShopHours()`, `parsePhones()` → thay `ShopInfoDrawer`, `MobileHeaderMenu`.
6. `lib/utils/wp-media.ts` — gom helper + constants WP → thay 2 trang `tin-tuc`.
7. `lib/utils/storage.ts` + `lib/hooks/useLocalStorage.ts` → thay 3+ nơi truy cập localStorage thô.
8. Bổ sung vào file có sẵn: `formatVnd` thống nhất ở `lib/utils/format.ts` (xoá `formatMoney`); `toLegacyWpMediaUrl` vào `format.ts`; `toGtmCartItems` vào `lib/analytics.ts`; `stripHtml/htmlToPlainText` vào `lib/utils/html.ts`; `uuid4` vào `lib/utils/uuid.ts`.

**Phase 2 — Hooks**
9. `lib/hooks/useMediaQuery.ts` (+ `useIsMobile`) → thay matchMedia/resize ở ~11 file.
10. `lib/hooks/useResponsiveValue.ts` (`useSlidesPerView`) → thay logic resize ở 3 carousel.
11. `lib/hooks/useScrollPosition.ts` → thay scroll listener ở sticky/scroll-to-top.

**Phase 3 — Shared components (UI primitives)**
12. `components/ui/icons.tsx` — `MenuIcon`, chevron, play → thay SVG inline.
13. `components/shared/CardIconButton.tsx` → thay shell nút ở `WishlistButton` + `CompareButton`.
14. `components/ui/FormNotice.tsx`, `components/ui/FormRootError.tsx`, `components/ui/AuthField.tsx`, `components/ui/AccountField.tsx` → de-dup form auth + account.
15. `components/shared/RadioCard.tsx` → group thanh toán/shipping.

**Phase 4 — Shared layout/feature components**
16. `components/shared/Carousel.tsx` + `components/shared/CarouselControls.tsx` → migrate 6 carousel.
17. `components/catalog/ProductArchiveResults.tsx` → 3 trang archive.
18. `components/catalog/WpPagination.tsx` (+ `buildWpPageWindow`) → `tin-tuc`, `tim-kiem`.
19. `components/account/AccountTable.tsx` → 3 trang tài khoản.
20. `components/layout/StaticPageShell.tsx` → ~8 trang CMS tĩnh.

**Phase 5 — API & data layer**
21. `lib/api/backend-proxy.ts` → thay 5 route handler `app/api/products/[id]/*`.
22. `lib/api/static-page.ts` (`loadStaticPage`) → cặp với `StaticPageShell`.
23. `lib/utils/catalog-params.ts` (`parseCatalogSearchParams`) → 3 trang archive.
24. Bổ sung `lib/seo/metadata.ts`: `buildCatalogMetadata()`, `buildSlugDetailMetadata()`.
25. Bổ sung method vào `lib/api/client-api.ts` để 4 component bỏ `fetch()` trực tiếp.

**Đã tốt, không cần đụng:** `ui/Skeletons.tsx`, `ui/QuantityStepper.tsx`, `ui/EmptyState.tsx`, `ui/ErrorState.tsx`, `ui/ContactInfoList.tsx`, các shadcn primitive `ui/*`, `AccountShell` (auth guard đã tập trung), `lib/utils/page-hero.ts`, các `loading.tsx` (đã delegate `Skeletons`). Vấn đề chính là nhiều feature component **không dùng** primitive sẵn có — ưu tiên route chúng về primitive thay vì viết mới.
