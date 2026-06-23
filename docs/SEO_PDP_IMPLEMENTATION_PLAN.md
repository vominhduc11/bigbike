# Kế hoạch triển khai Template SEO trang sản phẩm (PDP) — bigbike-web

> **Nguồn:** `ODsxBigbike_Template Service Page.xlsx` (khảo sát 11/06/2026, so sánh bigbike.vn với 4 đối thủ).
> **Lập kế hoạch:** 2026-06-12.
> **Phạm vi:** Áp dụng cho **bigbike-web (Next.js)** — codebase sẽ thay thế site WordPress đang chạy. KHÔNG triển khai trên WP cũ.

---

## 0. Bối cảnh & nguyên tắc

- Báo cáo khảo sát **site WordPress đang chạy** (`bigbike.vn/sp/<slug>.html`). Bản Next.js (`bigbike-web`) đã giải quyết sẵn một số điểm yếu của WP.
- Một số hạng mục trong checklist **không áp dụng** cho Next.js:
  - **#1 (một phần) / #21** "sửa `<p><strong>` → H2", "chống trùng schema WooCommerce + RankMath/Yoast" — Next.js chỉ có **1 nguồn schema** do code sinh, không có plugin trùng.
  - **Crawler timeout** (bigbike.vn fetch lỗi 2 lần) là vấn đề **hosting/CDN của WP**, không phải lỗi code → xử lý riêng ở tầng vận hành.
- Phần lớn hạng mục còn lại là **nội dung do Brand team viết** (sự thật về sản phẩm). Code chỉ tạo "chỗ để điền" và "khung hiển thị + schema".
- **Docs-First Contract:** mọi field dữ liệu mới (Giai đoạn 3) chạm `DATA_CONTRACT.md` + `API_CONTRACT.md` → **update docs trước, rồi mới sửa code, trong cùng PR**.

### Quy ước cột "Loại công việc"
- 🟦 **FE** = chỉ frontend bigbike-web
- 🟩 **BE+Admin+FE** = thêm field: backend (entity/DTO/migration) + admin (form) + web (render/schema) + docs
- 📝 **Nội dung** = Brand team viết, không cần code
- 🧪 **Vận hành** = kiểm thử / hạ tầng

---

## 1. Hiện trạng đối chiếu 28 hạng mục

| Trạng thái codebase | Hạng mục checklist |
|---|---|
| ✅ Đã có sẵn | #15 bảng spec (data-driven), #17 Product+Offer schema, breadcrumb HTML, H1 tên SP, hệ thống review (#28), internal link/related (#26) |
| 🟡 Có hạ tầng, chưa "bật" | #10/#19 FAQ (đã render, thiếu FAQPage schema), #20 BreadcrumbList (hàm có sẵn chưa gọi), #23 aggregateRating (đang đúng — chưa khai khống) |
| 🔴 Thiếu field + render + schema | #7/#18 Ưu–Nhược, #9 bảng size HTML, #11 bảo hành, #16 xuất xứ tách bạch, trọng lượng (#13/#17) |
| 🟠 Sửa cấu trúc HTML | #1/#6 heading tab → H2/H3, #5 khối trả lời nhanh, #14 text dưới video |
| 📝 Nội dung Brand team | #2 #3 #8 #12 #13 #24 #25 #27 #29 |
| 🧪 Kiểm thử/vận hành | #22 Rich Results Test; #21 N/A; crawler timeout (WP) |

### File codebase liên quan (tham chiếu nhanh)
| Vùng | File |
|---|---|
| Trang PDP + metadata | `bigbike-web/app/product/[slug]/page.tsx` |
| Schema JSON-LD | `bigbike-web/lib/seo/json-ld.ts` (`buildProductJsonLd`, `buildBreadcrumbJsonLd`, `buildFaqPageJsonLd`) |
| Metadata helper | `bigbike-web/lib/seo/metadata.ts` (`buildPublicMetadata`) |
| Tabs Mô tả/Thông số/FAQ | `bigbike-web/components/wp/WpProductTabs.tsx` |
| Buy box + H1 | `bigbike-web/components/wp/WpPurchaseSection.tsx` |
| Spec table / FAQ / Description | `bigbike-web/components/catalog/ProductLocalizedParts.tsx` |
| Gallery + video | `bigbike-web/components/catalog/ProductGallery.tsx` |
| Trust/contact cuối trang | `bigbike-web/components/catalog/ProductContactCta.tsx` |
| Ảnh + alt | `bigbike-web/components/ui/MediaImage.tsx` |
| Kiểu dữ liệu Product | `bigbike-web/lib/contracts/public.ts` |
| Docs cần update (GĐ3) | `docs/engineering/DATA_CONTRACT.md`, `docs/engineering/API_CONTRACT.md` |

---

## 2. Kế hoạch theo giai đoạn

### Giai đoạn 1 — "Bật" schema sẵn có  🟦 FE · rủi ro thấp · ưu tiên CAO

Chỉ sửa `lib/seo/json-ld.ts` + `app/product/[slug]/page.tsx`. Không đụng backend, không cần update docs.

| # | Việc | Hành động cụ thể | Item |
|---|---|---|---|
| 1.1 | FAQPage schema | Gọi `buildFaqPageJsonLd(product.faqs)` khi `faqs` không rỗng → inject `<script type="application/ld+json">` | #10, #19 |
| 1.2 | BreadcrumbList schema | Import & gọi `buildBreadcrumbJsonLd(product)` (hàm đã có, chưa dùng) | #20 |
| 1.3 | VideoObject schema | Sinh schema cho mỗi video trong `product.videos[]` (tên, link, ngày đăng nếu có) | #20 |
| 1.4 | AggregateRating (có điều kiện) | Thêm `aggregateRating` vào Product schema **CHỈ KHI** `ratingCount > 0` và có review thật hiển thị | #23 |

**Lưu ý #23:** tuyệt đối không khai `aggregateRating` khi chưa có review khách thật — vi phạm guideline Google. Gate theo `ratingCount > 0`.

**Tiêu chí hoàn thành:** Rich Results Test (GĐ6) báo Product + FAQPage + BreadcrumbList + VideoObject hợp lệ, 0 lỗi nghiêm trọng.

---

### Giai đoạn 2 — Cấu trúc HTML on-page  🟦 FE · rủi ro thấp–vừa

| # | Việc | Hành động cụ thể | Item |
|---|---|---|---|
| 2.1 | Heading tab = H2 thật | Trong `WpProductTabs.tsx`: tiêu đề "Mô tả / Thông số kĩ thuật / Câu hỏi thường gặp" dùng `<h2>` thật. **Sửa label mobile đang là CSS `::before`** (screen reader & bot không đọc được) | #1 |
| 2.2 | Tính năng → H3 | Đảm bảo nội dung mô tả (admin-authored) dùng `<h3>` cho từng tính năng; giữ nguyên nhận xét thật | #6 |
| 2.3 | Khối trả lời nhanh 40–60 từ | Render `shortDescription` thành block dẫn đầu (answer-first) **trước mọi heading** trong tab Mô tả; đồng bộ với `description` trong schema | #5 |
| 2.4 | Hiển thị `contentBottom` | Field đã có trong type nhưng **chưa render** — đưa ra cuối tab Mô tả để tăng độ sâu nội dung | #27 |
| 2.5 | Text dưới video | Thêm 2–3 câu mô tả nội dung dưới mỗi video embed trong gallery | #14 |

---

### Giai đoạn 3 — Field dữ liệu mới  🟩 BE+Admin+FE · rủi ro vừa–cao · ⚠️ CẦN DOCS-FIRST

> **Bắt buộc:** update `DATA_CONTRACT.md` + `API_CONTRACT.md` **trước**, rồi entity (Lombok) + DTO (`@Valid`) + MapStruct mapper + Flyway migration (backend) + admin form + web render/schema. Tất cả trong **cùng PR**.

| # | Field | Mục đích SEO | Triển khai | Item |
|---|---|---|---|---|
| 3.1 | `positiveNotes` / `negativeNotes` (Ưu / Nhược) | **USP độc quyền** — 4 đối thủ không có; vào schema `positiveNotes`/`negativeNotes` | Field riêng (list string) + khối hiển thị riêng + schema | #7, #18 |
| 3.2 | ~~`warrantyMonths` + phạm vi~~ | ~~Đối thủ có, BigBike thiếu — thua trust tại trang bán~~ | ~~Field + hiển thị trong trust block~~ — **đã gỡ:** field về `product_purchase_lines` (V249), rồi **module bảo hành gỡ hẳn (V266, 2026-06-23)** | #11 |
| 3.3 | Xuất xứ tách bạch | Phân biệt "thương hiệu [nước]" vs "sản xuất tại [nước]" | Có thể làm bằng **2 dòng trong bảng spec** (nội dung, không cần field) hoặc field riêng | #16 |
| 3.4 | `weightGram` | Vào Product schema (`weight`) + bảng spec | Field + schema | #13, #17 |
| 3.5 | Bảng size HTML | Cả 5 web dùng ảnh → làm `<table>` HTML là độc quyền | Field rich-content hoặc cấu trúc size rows + render `<table>` | #9 |
| 3.6 | Mô tả video (`VideoAsset.description`) | 2–3 câu text dưới video → bot hiểu nội dung + làm `description` cho VideoObject | Thêm field vào video; render caption dưới embed + đưa vào schema | #14 |

**Quyết định cần chốt với user trước khi code GĐ3:**
- Bảo hành / xuất xứ / trọng lượng: làm **dòng trong bảng spec** (nhanh, chỉ nội dung) **hay** field riêng (vào được schema có cấu trúc)?
  - Khuyến nghị: **trọng lượng + bảo hành = field riêng** (cần cho schema/trust), **xuất xứ = dòng spec**.
- Ưu/Nhược: **nên field riêng** vì là lợi thế cạnh tranh chính và cần vào schema.

---

### Giai đoạn 4 — Hình ảnh & alt  🟦 FE + 📝 Admin

| # | Việc | Hành động | Item |
|---|---|---|---|
| 4.1 | Alt mô tả nội dung | Cải thiện fallback trong `MediaImage.tsx`; mở field nhập alt trong admin; **không đánh số "Tem 01"** | #12 |
| 4.2 | 3 tỉ lệ ảnh 1:1 / 4:3 / 16:9 | Quy trình media + khai `image[]` trong schema | #13 |

---

### Giai đoạn 5 — Nội dung (Brand team)  📝

Code chỉ cung cấp chỗ điền; nội dung do Brand team viết theo template, tuân thủ **quy tắc trung thực** (không bịa số, không copy mô tả hãng).

| Item | Nội dung |
|---|---|
| #2 | Title tag theo công thức `[Tên SP] – [USP] | BigBike`, ≤60 ký tự |
| #3 | Meta description ≤155 ký tự: entity + 2 spec + giá; soát lỗi chính tả |
| #8 | Khối "Phù hợp với ai" — 3–4 câu nếu–thì + internal link |
| #24 | Soát quy tắc trung thực — số liệu thật, thiếu thì `[ĐIỀN]` |
| #25 | Entity nhất quán (1 cách viết tên SP toàn trang) |
| #27 | Độ dài 800–1.500 từ (tự đạt sau khi thêm FAQ + size + "phù hợp với ai") |
| #29 | Nhân bản template — ưu tiên 10 SP doanh thu cao nhất |

> ✅ Đã tạo: [PDP_CONTENT_GUIDE.md](PDP_CONTENT_GUIDE.md) — tiêu chuẩn viết mô tả/thông tin sản phẩm cho team SEO & Brand (bám đúng ô nhập admin + 28 tiêu chí khảo sát).

---

### Giai đoạn 6 — Kiểm thử & nhân bản  🧪

| # | Việc | Item |
|---|---|---|
| 6.1 | Chạy **Rich Results Test** (search.google.com/test/rich-results) sau GĐ1+GĐ3 — Product/FAQPage/Breadcrumb/Video hợp lệ, giá khớp | #22 |
| 6.2 | Nhân bản template cho SP doanh thu cao (theo Search Console) | #29 |
| 6.3 | (Vận hành — ngoài codebase) Kiểm tra hosting/CDN/firewall xử lý crawler timeout của **site WP** | — |

---

## 3. Thứ tự ưu tiên đề xuất

1. **Giai đoạn 1** — lợi nhất/rẻ nhất, thuần FE, làm ngay.
2. **Giai đoạn 2** — cấu trúc HTML, vẫn thuần FE.
3. **Giai đoạn 3** — nặng nhất, cần docs-first + backend; chốt quyết định field trước.
4. **Giai đoạn 4** — song song được với GĐ3.
5. **Giai đoạn 5** — Brand team chạy song song toàn bộ.
6. **Giai đoạn 6** — sau mỗi giai đoạn có schema.

---

## 4. Bảng theo dõi tiến độ

| GĐ | Hạng mục | Loại | Trạng thái | Người làm | Ghi chú |
|---|---|---|---|---|---|
| 1.1 | FAQPage schema | 🟦 FE | ☑ Xong (2026-06-12) | | Wired `buildFaqPageJsonLd` vào page.tsx |
| 1.2 | BreadcrumbList schema | 🟦 FE | ☑ Xong (2026-06-12) | | Khớp UI: ưu tiên brand → category |
| 1.3 | VideoObject schema | 🟦 FE | ☑ Xong (2026-06-12) | | `buildVideoObjectsJsonLd`; gate thumbnail; YouTube→embedUrl |
| 1.4 | AggregateRating (gated) | 🟦 FE | ☑ Xong (2026-06-12) | | Chỉ khai khi ratingCount > 0 |
| 2.1 | Heading tab → H2 | 🟦 FE | ☑ Xong (2026-06-12) | | `WpProductTabs`: H2 thật thay CSS `::before` (mobile-first) |
| 2.2 | Tính năng → H3 | 🟦/📝 | ☑ Hạ tầng sẵn | Brand team | `sanitizeRichHtml` đã giữ H2–H6 + đổi H1→H2; chỉ cần viết H3 trong mô tả |
| 2.3 | Khối trả lời nhanh | 🟦/📝 | ☑ Hạ tầng sẵn | Brand team | `shortDescription` đã ở buy box (above fold) + LÀ schema `description`; copy 40–60 từ do Brand team |
| 2.4 | Render contentBottom | 🟦 FE | ☑ Xong (2026-06-12) | | Render dưới khối tab; field đã có, trước đây bỏ quên |
| 2.5 | Text dưới video | 🟩 GĐ3 | 🟡 Schema xong, caption ẩn | | Gộp vào 3.6 |
| 3.1 | Ưu/Nhược + schema | 🟩 | ☑ Xong (2026-06-12) | | Bảng `product_highlights` (kind PRO/CON, song ngữ); render 2 cột + ItemList schema |
| 3.2 | ~~Bảo hành~~ | ⬜ | ☒ Đã gỡ (2026-06-23) | | `warranty_months` + `warranty_scope` chuyển sang `product_purchase_lines` (V249) rồi **module bảo hành gỡ hẳn (V266)**; 2 cột đã drop |
| 3.3 | Xuất xứ tách bạch | 🟩 | ☑ Xong (2026-06-12) | | `origin_brand_country` + `origin_manufacture_country` |
| 3.4 | ~~Trọng lượng + schema~~ | ⬜ | ☒ Đã gỡ (2026-06-19) | | Field `weightGrams` + schema `Product.weight` (QuantitativeValue) đã gỡ theo quyết định chủ shop. Cột `weight_kg` giữ trong DB nhưng không phơi/khai nữa. |
| 3.5 | Bảng size HTML | 🟩 | ☑ Xong (2026-06-12) | | `size_guide` rich-HTML; render sanitize |
| 3.6 | Mô tả video + schema | 🟩 | 🟡 Schema xong | | `product_videos.description` → VideoObject.description; caption hiển thị trong gallery còn lại (xem ghi chú) |
| 4.1 | Alt mô tả | 🟦/📝 | ☑ Xong (2026-06-12) | Brand team viết alt | Field nhập alt (ảnh chính + từng ảnh gallery) đã có sẵn trong admin; `MediaImage` nay lọc alt rác máy sinh (tên file / hash / số) → fallback tên SP |
| 4.2 | 3 tỉ lệ ảnh | 🟦/📝 | ☑ Code xong, ảnh do Brand | Brand team | `image[]` đã khai trong Product schema (`collectProductImages`); sản xuất ảnh 1:1/4:3/16:9 là quy trình media (operational) |
| 5 | Nội dung (#2,3,8,24,25,27,29) | 📝 | ◐ Chờ Brand team | Brand team | Code đã đủ "chỗ điền"; admin nay cảnh báo độ dài SEO theo giới hạn Google (tiêu đề ≤60, mô tả ≤155) — hỗ trợ #2/#3. Nội dung thật do Brand team viết |
| 6.1 | Rich Results Test | 🧪 | ☑ Code-side (2026-06-12) | | Bộ test `__tests__/seo/json-ld.test.ts` (14 check) validate Product/Offer/AggregateRating/weight/notes/Breadcrumb/FAQPage/VideoObject. Google RRT thật cần deploy public + dữ liệu Brand (operational) |
| 6.2 | Nhân bản template | 📝 | ☐ Chưa làm | Brand team | Theo Search Console; cần nội dung GĐ5 |
| 6.3 | Crawler timeout (WP) | 🧪 | ☐ Chưa làm | | Ngoài codebase |

---

## 5. Ghi chú triển khai Giai đoạn 3 (2026-06-12)

**Quyết định data shape:**
- Ưu/Nhược điểm: 1 bảng con `product_highlights` (cột `kind` PRO/CON), song ngữ inline `content`/`content_en` — admin sửa được EN qua nút VI/EN.
- ~~Bảo hành (`warranty_months`, `warranty_scope`)~~ **đã gỡ** (chuyển sang `product_purchase_lines` V249, rồi module bảo hành gỡ hẳn V266 — 2 cột đã drop), xuất xứ (`origin_brand_country`, `origin_manufacture_country`), bảng size (`size_guide`) = **1 ngôn ngữ** (fallback VI như giá/SKU) để giảm điểm chạm cơ chế `translations`. Có thể nâng song ngữ sau nếu cần.
- Trọng lượng: **đã gỡ (2026-06-19)** — field `weightGrams` và schema `Product.weight` không còn. Cột `weight_kg` vẫn còn trong DB (kích thước WooCommerce-import) nhưng không phơi ra UI/schema.

**⚠️ Cần làm khi deploy:** migration **V175** sẽ tự chạy khi backend khởi động (Flyway). Cần restart backend để áp schema mới — KHÔNG tự ý restart container (shared state), yêu cầu user.

**Còn lại (nhỏ):**
- Caption video hiển thị dưới embed: dữ liệu + schema đã có (`videos[].description` → `VideoObject.description`), nhưng video nằm trong gallery Swiper nên chưa render caption nhìn thấy. Cần chỉnh `ProductGallery` để hiện text — task UI riêng, không chặn SEO.

**Verify đã chạy:** backend `mvnw test-compile` sạch; web `tsc` + ESLint sạch; admin ESLint (2 file) sạch. Migration V175 + chạy thật trên DB chưa test (cần backend restart).

---

## 6. Ghi chú triển khai Giai đoạn 4 (2026-06-12)

**Hiện trạng trước khi làm — phần lớn hạ tầng đã có:**
- **Field nhập alt trong admin đã tồn tại**: ảnh đại diện (`imageAlt`) + từng ảnh gallery (`alt` mỗi card) + OG image; backend đã có cột `image_alt` (bảng `products`, `product_gallery_images`) và `ImageAsset.alt` trong DTO. Không cần thêm field/migration.
- **`image[]` trong Product schema đã khai** qua `collectProductImages()` (`lib/seo/json-ld.ts`): gộp ảnh chính + gallery + ảnh biến thể, khử trùng. Đáp ứng phần code của #13.

**Việc thực thi (chỉ FE, render-only — không chạm contract/data/permission/state → không cần docs-first):**
- `MediaImage.tsx` thêm `isDescriptiveAlt()`: bỏ qua alt **rác máy sinh** rồi dùng fallback tên sản phẩm. Lý do: kiểm tra DB thật cho thấy ~1.000+ ảnh WP-import có alt là tên file / mã tem / hash, **không mô tả nội dung** (checklist #12 "không đánh số 'Tem 01'"). Các mẫu bị lọc: slug-không-khoảng-trắng (`Balo-di-mo-to-...-01`), hash hex (`1f78…b5c8`, `z7536… cda9…`), toàn số (`1 1 3`), quá ngắn (`sx`). Alt do người viết (có khoảng trắng + chữ thật, kể cả tiếng Việt có dấu) luôn được giữ.

**Phần Brand team / vận hành (📝 — ngoài code):**
- Viết alt mô tả nội dung cho top sản phẩm (admin đã có chỗ nhập).
- Sản xuất ảnh 3 tỉ lệ 1:1 / 4:3 / 16:9 — quy trình media, không phải task code.

**Verify đã chạy:** web `tsc --noEmit` sạch; ESLint `MediaImage.tsx` sạch. Heuristic đối chiếu trực tiếp với mẫu alt thật trong `product_gallery_images` / `products.image_alt`.
