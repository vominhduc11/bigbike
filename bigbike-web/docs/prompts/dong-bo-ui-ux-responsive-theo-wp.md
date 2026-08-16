# Prompt lưu trữ — Đồng bộ UI/UX & responsive của `bigbike-web` theo bản tham chiếu WordPress

> Tài liệu lịch sử, không còn là prompt có thể chạy lại. Raw WordPress export đã được chủ dự án xoá vĩnh viễn. Khi làm việc hiện tại, dùng `bigbike-web/STYLEGUIDE.md`, design tokens, docs canonical và code đang có làm nguồn chuẩn; không giả định một bản WordPress local.

---

## Mục tiêu

Rà soát toàn bộ `bigbike-web` (Next.js) và **đồng bộ UI/UX, responsive theo các quyết định visual parity đã được ghi nhận**. Bản WordPress chỉ là bối cảnh lịch sử; **nguồn chuẩn hiện tại** là `STYLEGUIDE.md`, design tokens, docs canonical và code đang chạy.

Đây **KHÔNG phải** viết lại từ đầu. `bigbike-web` đã port phần lớn theo bản WP (CSS hiện tại có rất nhiều chú thích "WP-parity"). Yêu cầu thực chất là: **tìm những chỗ đã port lệch / chưa khớp với WP và chỉnh lại cho khớp**, đồng thời **giữ nguyên mọi cải tiến của bản Next.js** (trang mới, module/chức năng mới, các breakpoint lớn 3xl/4xl mà WP không có).

## Quy trình bắt buộc — KHẢO SÁT → ĐỀ XUẤT (option) → CHỜ DUYỆT → SỬA

Đây là ràng buộc quan trọng nhất. **TUYỆT ĐỐI không tự ý sửa code khi chưa được duyệt.**

1. **Giai đoạn 1 — Khảo sát (chỉ đọc):** đối chiếu từng khu vực ở mục "Phạm vi đối chiếu" giữa hai dự án. Không chỉnh sửa bất kỳ file nào.
2. **Giai đoạn 2 — Báo cáo dạng option:** xuất một **báo cáo lệch (divergence report)**. Gom theo từng trang/khu vực; mỗi điểm lệch là **một mục được đánh số** theo đúng mẫu:

   ```
   [#12] PDP — Thanh mua hàng dính đáy (mobile)
   - WP gốc:   product-detail.css §sticky-buy — bar cao 60px, padding 0 15px, hiện <768px
   - Next:     components/catalog/MobileStickyPurchaseBar.tsx — bar cao 72px, ẩn <640px
   - Lệch:     chiều cao +12px và ngưỡng hiện khác (640 vs 768) → lệch so với WP ở dải 640–768px
   - Đề xuất:  hạ về 60px, đổi ngưỡng hiện sang md (768px) qua token --bb-*
   - Ảnh hưởng / rủi ro: chỉ CSS, không đụng logic; rủi ro thấp
   - Có chạm cải tiến Next-only không? Không
   ```
3. **Giai đoạn 3 — Chờ tôi duyệt:** trình danh sách option rồi **DỪNG**. Tôi sẽ trả lời kiểu "duyệt #12, #14, #20" hoặc "bỏ #13". **Chỉ sửa đúng những mục tôi đã duyệt.** Nếu một mục còn mơ hồ (không rõ nên theo WP hay giữ Next), **hỏi lại bằng option** chứ không tự quyết.
4. **Giai đoạn 4 — Sửa theo lô + kiểm tra:** sửa từng lô đã duyệt, chạy phần "Kiểm tra", báo kết quả + diff tóm tắt, rồi mới sang lô tiếp theo.

> Gợi ý: dùng **plan mode** cho Giai đoạn 1–2. Không viết/sửa code trước khi tôi gõ duyệt.

## Bối cảnh kiến trúc (đã khảo sát — sửa tập trung qua token, KHÔNG rải rác từng component)

**`bigbike-web`** — Next.js 16.2.4 (App Router, TypeScript), Tailwind v4, shadcn/Radix, Swiper. Lưu ý: bản Next.js này có breaking change so với bản phổ thông — đọc `node_modules/next/dist/docs/` trước khi viết code (theo `AGENTS.md`).

- **Token hệ thống** `styles/brand-tokens.css` — biến `--bb-*` (màu, spacing `--bb-space-*`, radius, shadow, line-height, breakpoint…).
- **`app/globals.css`** (~4126 dòng) — CSS toàn site, đã chú thích dày đặc "WP-parity"; khối `@theme inline` map token sang utility Tailwind.
- **Typography** — thang chữ lỏng (fluid) canonical `--fs-*` (clamp), tài liệu chuẩn `docs/TYPOGRAPHY.md`; thang UI cố định `--text-ui-N`. **Mọi sửa typography phải đi qua `--fs-*` / `--text-ui-*`, không hardcode `text-[Npx]`.**
- **Class dùng chung** `lib/ui-classes.ts` (vd `iconBtn`, `submenuIcon`).
- **Breakpoint** — mặc định Tailwind `sm/md/lg/xl/2xl` = 640/768/1024/1280/1536, **cộng thêm** `--breakpoint-3xl: 1920px`, `--breakpoint-4xl: 2560px` (Next-only, GIỮ NGUYÊN). Còn vài breakpoint legacy 600/900px trong CSS homepage.

**Bản WordPress lưu trữ** — theme WordPress + WooCommerce đã từng được dùng làm baseline; raw source không còn được lưu trong workspace.

- **CSS chia theo trang:** `styles/main.css` (global: header/nav/footer/mobile menu), `home.css`, `product.css` + `product-detail.css`, `product-category.css` (dist), `cart.css`, `check-out.css`, `news.css` + `news-detail.css`, `login.css` + `register.css`, `payment-success.css`, `static-page.css`, `custom.css`. Bản minify trong `dist/`.
- **Template:** `page-templates/*.php`, `template-parts/*.php`, `woocommerce/**` (single-product, archive-product, cart, checkout, myaccount, loop…).
- **Breakpoint WP (kiểu Bootstrap, min-width):** **576 / 768 / 992 / 1200px** — **dừng ở 1200px, không có tầng ultra-wide.**

### Bảng ánh xạ breakpoint (dùng để quy đổi khi port quy tắc responsive từ WP)

| Vai trò | WP (Bootstrap) | bigbike-web (Tailwind) |
|---|---|---|
| Phone | mặc định | mặc định |
| Landscape phone | `≥576px` | `sm ≥640px` |
| Tablet | `≥768px` | `md ≥768px` |
| Desktop nhỏ | `≥992px` | `lg ≥1024px` |
| Desktop | `≥1200px` | `xl ≥1280px` |
| Wide → 4K | — (không có) | `2xl 1536` / `3xl 1920` / `4xl 2560` (**Next-only, giữ nguyên**) |

→ Hai chỗ dễ lệch nhất là **992↔1024** và **1200↔1280**: layout WP đổi cột/bố cục sớm hơn Next ~24–80px. Khi WP "đẹp hơn" ở dải tablet/desktop nhỏ, ưu tiên khớp **hành vi** (số cột, khoảng cách, thứ tự xếp) tại breakpoint Next gần nhất, **không** đẻ thêm breakpoint mới ngoài thang đã có.

## Phạm vi đối chiếu (đi lần lượt từng khu vực)

Với mỗi khu vực, so sánh: **bố cục & số cột theo từng breakpoint · khoảng cách (margin/padding/gap) · cỡ & cân chữ (typography) · hành vi component (sticky, drawer, carousel, accordion) · touch target ≥44px · tràn ngang (overflow-x) · trạng thái mobile vs desktop.**

1. **Header + Navigation + Mega menu** — WP `styles/main.css` (header, `.navigation`, mobile menu) ↔ `components/layout/SiteHeader.tsx`, `MobileHeaderMenu.tsx`, `StickyHeaderShell.tsx`, `MobileBottomNav.tsx`, `lib/ui-classes.ts`.
2. **Footer** — WP `main.css` (footer) ↔ `SiteFooter.tsx`, `FooterCollapsible.tsx`.
3. **Trang chủ** — WP `home.css` (hero slider, feature row, products, experience, news, brand carousel, SEO content) ↔ `app/page.tsx` + `components/home/*` (HeroSlider, FeaturedProductsCarousel, ExperienceCarousel, HomeVideoCarousel, BrandCarousel).
4. **Danh mục / Lưu trữ sản phẩm + Bộ lọc** — WP `product-category.css`, `archive-product.php`, `template-parts/product-filter.php`, `content-product-grid-item.php` ↔ `app/san-pham`, `app/danh-muc-san-pham/[slug]`, `components/catalog/ProductArchive*`, `CatalogFilters.tsx`, `CatalogSortSelect.tsx`.
5. **Chi tiết sản phẩm (PDP)** — WP `product-detail.css` + `product.css`, `woocommerce/single-product*` ↔ `app/product/[slug]`, `components/catalog/ProductGallery.tsx`, `PurchaseSectionClient.tsx`, `ProductTabs.tsx`, `ProductSpecTable.tsx`, `MobileStickyPurchaseBar.tsx`, `MobilePdpAnchorNav.tsx`, `ReviewsSection.tsx`.
6. **Giỏ hàng** — WP `cart.css`, `woocommerce/cart/**` ↔ `app/gio-hang`, `MobileCartSheet.tsx`.
7. **Thanh toán** — WP `check-out.css`, `woocommerce/checkout/**` ↔ `app/thanh-toan`, `VnAddressFields.tsx`.
8. **Tài khoản** — WP `woocommerce/myaccount/**` ↔ `app/tai-khoan/**`, `AccountShell.tsx`.
9. **Tin tức / Bài viết** — WP `news.css` + `news-detail.css` ↔ `app/tin-tuc/**`, `components/content/*`, `ArticleTableOfContents.tsx`.
10. **Đăng nhập / Đăng ký / Quên mật khẩu** — WP `login.css` + `register.css` ↔ `app/dang-nhap`, `app/dang-ky`, `app/quen-mat-khau`.
11. **Trang tĩnh / Chính sách / Giới thiệu / Hướng dẫn / Bảo hành / Liên hệ** — WP `static-page.css`, `page-static.php`, `page-guide.php` ↔ `app/chinh-sach/[slug]`, `app/gioi-thieu`, `app/huong-dan`, `app/bao-hanh`, `app/lien-he`, `PolicySidebar.tsx`.
12. **Đặt hàng thành công** — WP `payment-success.css` ↔ `app/thanh-toan/order-received/[id]`.
13. **So sánh sản phẩm** — *(Next-only — bản WP có thể không có).* Nếu không có đối chiếu WP thì **bỏ qua, không tự đổi** trừ khi nó vỡ responsive rõ ràng → khi đó báo thành option riêng, ghi rõ "Next-only".

## Ràng buộc — GIỮ NGUYÊN, không được đụng

- **Mọi cải tiến của bản Next.js:** trang mới, module/chức năng mới, route không có ở WP → **giữ nguyên**. Chỉ chỉnh phần UI/UX/responsive khi tôi duyệt.
- **Các breakpoint lớn Next-only** `2xl/3xl/4xl` (1536/1920/2560px) → **giữ nguyên**. WP không có tầng này; không được xoá để "cho giống WP".
- **Logic, data-fetching, state, route, API, SEO/metadata, schema, a11y** → không đổi. Đây là việc **chỉ về UI/UX/responsive (CSS, class, markup trình bày)**.
- **Hệ thống token & convention hiện có:** sửa qua `--bb-*`, `--fs-*`, `--text-ui-*`, utility Tailwind và `lib/ui-classes.ts`. **Không** thêm `text-[Npx]`, **không** viết media query px thô khi đã có token breakpoint, **không** phá kiến trúc CSS tập trung để vá lẻ từng component.
- **Không "nâng cấp" WP:** mục tiêu là *khớp* WP, không phải làm đẹp hơn WP theo ý mình. Mọi sai khác chủ ý so với WP phải là **option có giải thích để tôi quyết**.
- **Không đổi font** trong đợt này (việc font xử lý riêng ở `docs/prompts/chuyen-font-he-thong.md`).

## Kiểm tra (chạy hết sau mỗi lô đã duyệt và báo kết quả)

1. `npm run build` → pass (gồm typecheck).
2. `npm run lint` → pass (gồm `check:no-runtime-business-data` + eslint).
3. `npm run test` (vitest) → pass.
4. `npm run test:e2e:responsive` và `npm run test:e2e:visual` → pass; nếu snapshot đổi do chỉnh đúng ý, nêu rõ ảnh nào đổi và vì sao trước khi cập nhật baseline.
5. **Đối chiếu trực quan** (`npm run dev`, cổng 3001) tại các viewport mốc **360 / 576 / 768 / 992 / 1200 / 1440 / 1920px**, so cạnh bản WP gốc cho từng mục đã sửa.
6. `grep -rn "text-\[" app components` cho vùng vừa sửa → không phát sinh size hardcode mới (phải dùng token).
7. Xác nhận **không tràn ngang** (`document.documentElement.scrollWidth <= clientWidth`) ở mọi viewport mốc trên từng trang đã chạm.

## Đầu ra

1. **Báo cáo lệch** (Giai đoạn 2) dạng danh sách option đánh số, gom theo trang/khu vực, kèm mức rủi ro và cờ "Next-only".
2. Sau khi tôi duyệt: với mỗi lô — **danh sách file đã sửa + diff tóm tắt** và **kết quả từng bước Kiểm tra**.
3. Cuối cùng: bảng tổng "mục đã duyệt & sửa / mục bỏ / mục còn chờ tôi quyết".

**Bắt đầu bằng Giai đoạn 1 (khảo sát, chỉ đọc) và trình báo cáo option ở Giai đoạn 2. DỪNG, chờ tôi duyệt trước khi sửa bất cứ thứ gì.**
