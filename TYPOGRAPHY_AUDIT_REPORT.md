# BIGBIKE-WEB — Báo cáo audit typography

> Ngày audit: 2026-08-01  
> Phạm vi: `bigbike-web/app/`, `components/`, `lib/`, `styles/`, `docs/`  
> Source of truth đã được owner xác nhận: `bigbike-web/docs/TYPOGRAPHY.md`  
> Trạng thái typography: **đã chuẩn hóa code + docs và computed verify đạt 93/93**.

## 1. Tóm tắt

Hệ typography hiện tại có **11 nhóm**:

- **B1–B5:** Barlow Condensed, IN HOA, dùng cho display/liên hệ/promo/action/nhãn.
- **A1–A5:** Arial/Helvetica, sentence case, dùng cho title/content/meta.
- **D:** riêng chữ `404` trang trí, dùng `clamp()` tại component.

Mười nhóm A/B chỉ có hai nấc. Trong báo cáo này, **Tablet = nấc thứ hai (`>=768px`)**; không có breakpoint typography thứ ba.

## 2. Canonical groups

| Nhóm | Vai trò | Font family | Mobile px | Tablet px | Token / utility thực tế trong code | Ví dụ file / component đang dùng |
|---|---|---|---:|---:|---|---|
| B1 | Display / slogan / kết quả nổi bật | Barlow Condensed | 32 | 40 | `--bb-text-b1-display` / `text-b1-display` | `components/layout/Footer.tsx:161` |
| B2 | Contact lớn / hotline | Barlow Condensed | 24 | 32 | `--bb-text-b2-contact` / `text-b2-contact` | `components/layout/Footer.tsx:166` |
| B3 | Promo / badge % / sale | Barlow Condensed | 18 | 20 | `--bb-text-b3-promo` / `text-b3-promo` | `components/catalog/ProductCard.tsx:73` |
| B4 | Action / menu / tab | Barlow Condensed | 18 | 20 | `--bb-text-b4-action` / `text-b4-action` | `components/ui/button.tsx:8` |
| B5 | Eyebrow / label / badge nhỏ | Barlow Condensed | 12 | 14 | `--bb-text-b5-label` / `text-b5-label` | `components/content/ArticleCard.tsx:61` |
| A1 | H1 / title lớn | Arial / Helvetica | 28 | 32 | `--bb-text-a1-title` / `text-a1-title` | `components/home/HomeLocalizedSettings.tsx:67` |
| A2 | H2 / page title | Arial / Helvetica | 22 | 26 | `--bb-text-a2-page` / `text-a2-page` | `components/layout/PageHero.tsx:51` |
| A3 | H3 / section title | Arial / Helvetica | 20 | 22 | `--bb-text-a3-section` / `text-a3-section` | `components/catalog/product-view/PdpSection.tsx:30` |
| A4 | Body / content / title nhỏ / input | Arial / Helvetica | 18 | 20 | `--bb-text-a4-content` / `text-a4-content` | `components/catalog/ProductCard.tsx:94` |
| A5 | Meta / caption / breadcrumb / giá card | Arial / Helvetica | 14 | 16 | `--bb-text-a5-meta` / `text-a5-meta` | `components/catalog/ProductCard.tsx:110` |
| D | Decorative / 404 | Component-specific | `clamp()` | `clamp()` | `text-[clamp(7rem,22vw,14rem)]` — ngoại lệ duy nhất | `app/[locale]/not-found.tsx:41` |

Giá trị nguồn nằm tại `styles/brand-tokens.css:136–145` và đổi đúng một lần trong `@media (min-width: 768px)` tại `styles/brand-tokens.css:358–367`.

## 3. Legacy mapping

| Class / token cũ | Nhóm chuẩn tương ứng | Lý do map | File / line tham chiếu |
|---|---|---|---|
| `text-display`, `--fs-display` | B1 | Display/slogan | Historical: `docs/audits/TYPOGRAPHY_SCALE_AUDIT.md:12`; canonical: `docs/TYPOGRAPHY.md:19` |
| `text-button` | B4 | Nút/action | Historical: `docs/audits/TYPOGRAPHY_SCALE_AUDIT.md:12`; actual: `components/ui/button.tsx:8` |
| `text-overline` | B5 | Eyebrow/nhãn nhỏ | Historical: `docs/audits/TYPOGRAPHY_SCALE_AUDIT.md:12`; actual: `lib/ui-classes.ts:47` |
| `text-h1` / `h2` / `h3` / `h4` | A1 / A2 / A3 / A4 | Map theo cấp semantic heading | `docs/TYPOGRAPHY.md:24–27` |
| `text-body`, `text-body-lg` | A4 | Nội dung đọc | `docs/TYPOGRAPHY.md:27`; actual: `components/catalog/ProductCard.tsx:94` |
| `text-caption` | A5 | Meta/caption | `docs/TYPOGRAPHY.md:28`; actual: `components/catalog/ProductCard.tsx:110` |
| `font-heading` | `font-body` + token A phù hợp | Alias không được expose và làm sai family nhóm A | Đã loại khỏi `components/catalog/**`; rule: `docs/TYPOGRAPHY.md:68` |
| `text-category-label` | A4 / `text-a4-content` | Nhãn danh mục là title nhỏ, không phải nhóm riêng | `STYLEGUIDE.md:154`; actual: `components/home/HomeCategoryGrid.tsx:36` |
| `.product--item-title` | A4 | Tên sản phẩm/card nhỏ | `app/globals.css:4622` |
| `.product--item-price p.old` | A5 | Giá phụ/gạch | `app/globals.css:4636` |
| `.product--item-cart a` | B4 | Action mua hàng | `app/globals.css:4643` |
| `.widget--title h3` | A3 | Tiêu đề sidebar | `app/globals.css:4650` |
| `text-ui-*`, built-in `text-sm/lg/xl/...` | Không map theo số | Phải map theo vai trò semantic, không map chỉ theo px | Historical: `docs/TYPOGRAPHY_AUDIT.md`; rule: `docs/TYPOGRAPHY.md:70` |

## 4. Deviations đã xử lý

| File | Line | Vấn đề phát hiện | Cách sửa đề xuất / kết quả |
|---|---:|---|---|
| `STYLEGUIDE.md` | 20–24 | Gộp mọi heading vào Barlow và nói heading “thường” IN HOA, trái nhóm A. | Đã tách rõ A = Arial/sentence case, B = Barlow/IN HOA. |
| `STYLEGUIDE.md` | 154 | Category label vừa ghi Barlow/UPPERCASE vừa ghi A4. | Đã chốt A4, Arial/Helvetica, sentence case, weight 600. |
| `docs/TYPOGRAPHY.md` | 81–86 | Liệt kê sáu alias font không tồn tại và dặn chỉ sửa size. | Đã rút còn `font-body`/`font-cta`; yêu cầu sửa cả family khi lệch semantic. |
| `styles/brand-tokens.css`, `app/globals.css`, `HomeCategoryGrid.tsx` | 136 / 107 / 36 | Alias riêng `text-category-label` tạo nấc thứ 12. | Đã xóa alias và dùng A4 canonical. |
| `components/**`, `app/[locale]/**`, `lib/ui-classes.ts` | nhiều | 99 dòng nhóm A dùng alias Barlow/không tồn tại; 13 dòng nhóm B dùng Arial. | Đã map theo vai trò; scan cuối còn 0 mismatch A/B family/case. |
| `PaginationNav.tsx`, `ArticleCard.tsx`, `HeroSlider.tsx`, `ExperienceCarousel.tsx`, `Footer.tsx`, `MobileCartSheet.tsx`, `PurchaseSection.tsx` | nhiều | 14 dòng dùng `leading-[...]`; một `tracking-wider`; ba arbitrary font-family. | Đã dùng `leading-title/body`, tracking token hoặc flex alignment; arbitrary còn 0. |
| `ContactPageContent.tsx` | 128–136, 171–177, 218–230, 375–382, 508–509, 638–655 | Chín inline typography declarations và A/B family lệch. | Đã chuyển typography sang utility/token; inline typography còn 0. |
| `app/globals.css`, `styles/brand-tokens.css` | nhiều | Rich text dùng Barlow cho size A; hardcode line-height/tracking; mã đơn dùng monospace ngoài hai font chuẩn. | Đã đưa heading A về body font, line/tracking về token, mã đơn về A5/body. `line-height:1` chỉ còn cho control một dòng/icon và không có token tương đương. |
| `app/fonts.ts`, `Footer.tsx`, `layout/search/styles.ts` | 3–8 / 125 / 44 | Barlow nạp weight 900 không dùng; caller yêu cầu 500 không được nạp. | Caller chuyển 500→600; font chỉ nạp 400/600/700. |
| `scripts/verify-typography-computed.mjs` | toàn file | Verifier cũ kỳ vọng WP legacy: ProductCard/H1 Barlow, section 24/35, breadcrumb 16. | Đã viết lại theo đúng 11 nhóm và breakpoint 768px; output đặt trong `bigbike-web/docs/audits/runtime/`. |
| `docs/prompts/chuyen-font-he-thong.md` | toàn file | Prompt cũ yêu cầu gỡ toàn bộ Barlow, trái canonical. | Đã thay bằng notice historical ngắn, không còn checklist có thể chạy nhầm. |

**Deviation typography còn mở: không có.**

## 5. File đã sửa

Core/docs/verification:

- `bigbike-web/STYLEGUIDE.md`
- `bigbike-web/docs/TYPOGRAPHY.md`
- `bigbike-web/docs/prompts/chuyen-font-he-thong.md`
- `bigbike-web/styles/brand-tokens.css`
- `bigbike-web/app/globals.css`
- `bigbike-web/app/fonts.ts`
- `bigbike-web/scripts/verify-typography-computed.mjs`
- `bigbike-web/docs/audits/runtime/typography-computed-results.json`
- `TYPOGRAPHY_AUDIT_REPORT.md`

App/lib:

- `bigbike-web/app/[locale]/not-found.tsx`, `xac-nhan-email/VerifyEmailContent.tsx`, `dang-ky/RegisterForm.tsx`
- `bigbike-web/app/[locale]/tin-tuc/[slug]/ArticleView.tsx`, `huong-dan/GuidePage.tsx`
- `bigbike-web/app/[locale]/brands/BrandListDefault.tsx`, `BrandListClient.tsx`
- `bigbike-web/app/[locale]/tai-khoan/edit-address/[type]/AddressBookContent.tsx`, `tai-khoan/don-hang/OrderHistoryContent.tsx`
- `bigbike-web/app/[locale]/gio-hang/loading.tsx`, `don-hang/xac-nhan/OrderConfirmView.tsx`
- `bigbike-web/lib/cart-context.tsx`, `bigbike-web/lib/ui-classes.ts`

Components:

- `components/about/AboutPageContent.tsx`, `account/AccountNav.tsx`, `auth/AuthPageFrame.tsx`
- `components/cart/CartClient.tsx`, `cart/parts/CartItemRow.tsx`, `cart/parts/CartSummary.tsx`
- `components/catalog/CatalogSidebar.tsx`, `MobilePdpAnchorNav.tsx`, `ProductCard.tsx`, `ProductContactCta.tsx`, `ProductDescriptionBlocks.tsx`, `ProductLocalizedParts.tsx`, `PurchaseSection.tsx`, `RecentlyViewedSection.tsx`
- `components/catalog/description-blocks/blocks.tsx`, `product-view/PdpSection.tsx`, `product-view/ProductTrustCard.tsx`
- `components/catalog/purchase/BuyButtons.tsx`, `QuantityStepper.tsx`, `VariantPicker.tsx`
- `components/catalog/reviews/RatingSummary.tsx`, `ReviewCard.tsx`, `WriteReviewForm.tsx`, `states.tsx`
- `components/checkout/CheckoutClient.tsx`, `checkout/parts/CheckoutSummary.tsx`, `checkout/parts/atoms.tsx`
- `components/contact/ContactPageContent.tsx`, `content/ArticleCard.tsx`, `content/ArticleCategoryNav.tsx`
- `components/guide/ClothingSizeGuideContent.tsx`, `ClothingSizeTool.tsx`, `HelmetSizeGuideContent.tsx`, `HelmetSizeTool.tsx`
- `components/home/ExperienceCarousel.tsx`, `FloatingChat.tsx`, `HeroSlider.tsx`, `HomeCategoryGrid.tsx`, `HomeLocalizedSettings.tsx`, `HomeNewsList.tsx`, `home/video-carousel/VideoCard.tsx`
- `components/layout/CheckoutPageHeading.tsx`, `Footer.tsx`, `MobileBottomNav.tsx`, `MobileCartSheet.tsx`, `PageHero.tsx`, `RichContent.tsx`
- `components/layout/header/HeaderCartCount.tsx`, `HeaderMenu.tsx`, `HeaderUser.tsx`, `LanguageSwitch.tsx`
- `components/layout/search/MobileSearchBody.tsx`, `PreSuggestions.tsx`, `SuggestionResults.tsx`, `styles.ts`
- `components/policy/PrivacyPolicyContent.tsx`, `WarrantyPolicyContent.tsx`
- `components/ui/Avatar.tsx`, `PaginationNav.tsx`, `VnAddressFields.tsx`, `accordion.tsx`, `badge.tsx`, `card.tsx`, `dialog.tsx`, `select.tsx`, `sheet.tsx`

Diff chỉ đổi typography/classes/docs/verifier; không đổi business logic, route, data, màu hoặc layout ngoài việc thay line-height px dùng để căn giữa bằng flex tương đương.

## 6. Verify cuối

- Scan `rg`: **645 dòng / 121 file** dùng utility A/B canonical.
- Built-in font-size (`text-sm`, `text-lg`, `text-xl`…): **0**.
- Arbitrary `leading-[...]`, `tracking-[...]`, `tracking-wider/widest`, arbitrary font-family, inline `fontSize/fontFamily/letterSpacing/lineHeight`: **0**.
- Arbitrary font-size: **1**, đúng ngoại lệ D tại `app/[locale]/not-found.tsx:41`.
- Alias `font-heading`, `text-category-label`: **0** trong code/current docs.
- Mismatch A + Barlow/uppercase: **0**; mismatch B + Arial: **0**.
- Computed style: `node scripts/verify-typography-computed.mjs` với `BASE_URL=http://localhost:3001` → **93 pass / 0 fail** cho A1–A5, B1–B5, D tại 375/768/1440px.
- Lint riêng verifier/hotspot typography → **đạt**.
- Full `npm run lint` → **đạt**, gồm cả guard dữ liệu runtime.
- `npm run build` → **đạt**, TypeScript và 66 trang tĩnh đều hoàn tất.
- `npm test` → **229/238 pass**; 9 lỗi ngoài typography do `RatingStars` gọi `useTranslations` nhưng test chưa bọc `NextIntlClientProvider` (7 test trực tiếp, 1 `ProductCard`, 1 `PurchaseSection`).

Chín lỗi test nền không được tự sửa vì nằm ngoài phạm vi typography và thuộc thay đổi i18n đang diễn ra đồng thời.

## 7. Phần đã xác minh và historical context

Đã xác minh bằng code/computed style: bảng canonical, token mobile/tablet, breakpoint 768px, family A/B, uppercase B, các utility thực tế và ngoại lệ D.

Chỉ dùng làm historical context, không canonical:

- `bigbike-web/docs/TYPOGRAPHY_AUDIT.md`
- `bigbike-web/docs/audits/TYPOGRAPHY_SCALE_AUDIT.md`
- `bigbike-web/docs/prompts/chuyen-font-he-thong.md`

## 8. Kết luận kích thước

| Nhóm | Mobile | Tablet (`>=768px`) |
|---|---:|---:|
| B1 | 32px | 40px |
| B2 | 24px | 32px |
| B3 | 18px | 20px |
| B4 | 18px | 20px |
| B5 | 12px | 14px |
| A1 | 28px | 32px |
| A2 | 22px | 26px |
| A3 | 20px | 22px |
| A4 | 18px | 20px |
| A5 | 14px | 16px |
| D | `clamp()` | `clamp()` |
