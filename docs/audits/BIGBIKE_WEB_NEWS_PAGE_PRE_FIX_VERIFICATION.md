# BigBike Web News Page Pre-Fix Verification

**Trang kiểm tra**: `/tin-tuc/` (Article list)
**Ngày**: 2026-05-13
**Vai trò**: Senior Frontend Engineer + UI/UX Reviewer
**Mục tiêu**: Xác minh bằng chứng từng vấn đề **trước khi** đề xuất hoặc thực hiện fix.

---

## Scope

Đã đọc & phân tích:

- [bigbike-web/app/tin-tuc/page.tsx](../../bigbike-web/app/tin-tuc/page.tsx)
- [bigbike-web/components/content/ArticleCard.tsx](../../bigbike-web/components/content/ArticleCard.tsx)
- [bigbike-web/components/layout/PageHero.tsx](../../bigbike-web/components/layout/PageHero.tsx)
- [bigbike-web/components/ui/PaginationNav.tsx](../../bigbike-web/components/ui/PaginationNav.tsx)
- [bigbike-web/components/home/FloatingChat.tsx](../../bigbike-web/components/home/FloatingChat.tsx)
- [bigbike-web/components/layout/FloatingChatLoader.tsx](../../bigbike-web/components/layout/FloatingChatLoader.tsx)
- [bigbike-web/components/ui/MediaImage.tsx](../../bigbike-web/components/ui/MediaImage.tsx)
- [bigbike-web/app/globals.css](../../bigbike-web/app/globals.css) — các khối `.wp-news-*`, `.wp-cat-hero*`, `.wp-chat-*`, `.bb-pagination*`, `.bb-button*`, `.wp-floating-group`
- [bigbike-web/lib/api/public-api.ts](../../bigbike-web/lib/api/public-api.ts) — `listArticles`
- [bigbike-web/lib/contracts/public.ts](../../bigbike-web/lib/contracts/public.ts) — `Article`, `ContentCategorySummary`
- [bigbike-web/lib/utils/format.ts](../../bigbike-web/lib/utils/format.ts) — `safeText`
- [bigbike-backend/src/main/resources/openapi/bigbike-openapi.json](../../bigbike-backend/src/main/resources/openapi/bigbike-openapi.json) — endpoint articles/categories
- [docs/engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md)

KHÔNG runtime test (chỉ đọc tĩnh source + đối chiếu screenshot mô tả).

---

## Executive Summary

| # | Vấn đề | Status | Severity |
|---|---|---|---|
| F1 | Filter dùng input text cho slug danh mục | **Confirmed** | P1 |
| F2 | Featured card bị kéo giãn / "Đọc tiếp" đẩy xuống thấp | **Partially confirmed** (phụ thuộc data) | P2 |
| F3 | Excerpt fallback "Nội dung đang được cập nhật." | **Confirmed** | P1 |
| F4 | Card grid spacing & equal height | **Partially confirmed** (line-clamp đã có, có duplicate CSS) | P2 |
| F5 | Ảnh cover bài viết không đồng bộ | **Not confirmed via code** (CSS đã set crop) — cần content audit | P2 |
| F6 | Hero hierarchy/contrast | **Partially confirmed** (template fallback dùng chung tất cả trang) | P3 |
| F7 | Floating chat đè nội dung | **Needs runtime data** (CSS đúng spec, chưa có overlap khẳng định) | P2 |
| F8 | Pagination visual không đồng bộ | **Confirmed** (prev/next dùng button class khác hẳn page number) | P2 |

**Kết luận ngắn**:

- **Nên fix (P1)**: F1 (filter UX), F3 (excerpt fallback). Đây là hai vấn đề ảnh hưởng trực tiếp đến chất lượng cảm nhận trên public site và an toàn fix.
- **Nên fix (P2)**: F2 (featured layout), F4 (CSS duplicate + alignment), F8 (pagination visual). Đều là CSS-only.
- **Khảo sát thêm (P2/P3)**: F5 (content quality), F6 (hero), F7 (runtime check). Cần dữ liệu thực tế hoặc decision design.
- KHÔNG được "fix" trong cùng PR: API contract `/api/v1/articles`, query param shape, pagination logic, SEO metadata, `noIndex` rule khi có filter, routing.

---

## Findings

### [F1] Filter UX chưa chuyên nghiệp — input slug thay vì dropdown/chip

- **Status**: Confirmed
- **Severity**: P1
- **Evidence**:
  - File: [bigbike-web/app/tin-tuc/page.tsx#L183-L191](../../bigbike-web/app/tin-tuc/page.tsx#L183-L191)
  - Code:
    ```tsx
    <div className="wp-field">
      <label>Danh mục</label>
      <input
        name="category"
        defaultValue={categoryParsed.value}
        className="wp-input"
        placeholder="VD: tin-tuc, huong-dan..."
      />
    </div>
    ```
  - Field `category` là **plain `<input type=text>`**, user phải tự gõ **slug** (`tin-tuc`, `huong-dan`...). Placeholder cũng hint slug — đây là UX của developer, không phải end-user.
  - Đồng thời, file có chip strip ở [page.tsx#L214-L241](../../bigbike-web/app/tin-tuc/page.tsx#L214-L241) (`wp-news-category-strip`) — nhưng chip này **chỉ render khi `categories.length > 0`** và `categories` được derive từ **`collectArticleCategories(articles)`** ([page.tsx#L36-L51](../../bigbike-web/app/tin-tuc/page.tsx#L36-L51)) — chỉ lấy từ articles **trong trang hiện tại** (mặc định 12 bài). Tức là chip strip là một **partial view** của tập category thật, không phải đủ.
  - Backend OpenAPI ([bigbike-openapi.json](../../bigbike-backend/src/main/resources/openapi/bigbike-openapi.json#L476-L538)) chỉ expose `/api/v1/articles` và `/api/v1/articles/{slug}` cho public — **không có endpoint public liệt kê content categories**. Endpoint `/api/v1/admin/content/reference/categories` tồn tại nhưng yêu cầu admin JWT, không dùng cho public site.
- **Root cause**:
  - Thiếu public endpoint `GET /api/v1/articles/categories` (hoặc tương đương) → frontend không có nguồn dữ liệu đầy đủ → fallback dùng input text + chip strip partial.
- **Risk nếu fix**:
  - Thêm public endpoint = thay đổi API contract → phải update `docs/engineering/API_CONTRACT.md` trước (Docs-First Contract).
  - Đổi `category` từ input → `<select>`/dropdown không phá query param shape (`?category=tin-tuc`), nhưng phải đảm bảo SSR vẫn submit form đúng.
  - Vẫn phải giữ chip strip ở dạng đầy đủ — không xoá category param logic.
- **Safe fix direction**:
  - **Phase 1 (chỉ frontend, không đổi API)**: Đổi `<input name="category">` thành `<select>` dùng danh sách `categories` đã derive (giữ nguyên list partial nhưng UX tốt hơn so với gõ slug). Nếu user search ra category không có trong list → chip strip vẫn highlight `categoryParsed.value` qua `activeCategoryLabel`.
  - **Phase 2 (cần backend)**: Thêm public endpoint `GET /api/v1/articles/categories` trả về full list. Update `API_CONTRACT.md` trước. Sau đó: frontend prefetch full list, render chip strip + dropdown đầy đủ.
- **Không nên làm**:
  - Hard-code danh sách category cứng trong frontend.
  - Bỏ field `category` input/select để né vấn đề.
  - Đổi tên query param `category`.

---

### [F2] Featured article bị trống/kéo giãn

- **Status**: Partially confirmed (phụ thuộc length của excerpt)
- **Severity**: P2
- **Evidence**:
  - File: [bigbike-web/components/content/ArticleCard.tsx](../../bigbike-web/components/content/ArticleCard.tsx) — featured **dùng chung structure** với card thường, chỉ thêm modifier class `wp-news-card-featured`:
    ```tsx
    className={`wp-news-card${variant === "featured" ? " wp-news-card-featured" : ""}`}
    ```
  - CSS featured (globals.css#L5718-L5722):
    ```css
    .wp-news-card-featured { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(320px, 0.75fr); margin-bottom: 22px; min-height: 360px; }
    .wp-news-card-featured .wp-news-img-wrap { aspect-ratio: auto; height: 100%; min-height: 320px; }
    .wp-news-card-featured .wp-news-body { justify-content: center; padding: 41px 34px 30px; }
    .wp-news-card-featured .wp-news-card-title { font-size: clamp(1.4rem, 2.6vw, 2.3rem); line-height: 1.12; -webkit-line-clamp: 3; }
    .wp-news-card-featured .wp-news-excerpt { font-size: 14px; line-height: 1.65; color: var(--bb-text-secondary); min-height: 0; }
    ```
  - Bên trong body: `.wp-news-body-inside` `flex: 1`, các con (`meta`, `title`, `excerpt`, `read-more`) layout column với `gap: 8px`; `.wp-news-read-more` có `margin-top: auto` (globals.css#L5716) đẩy "Đọc tiếp" về cuối container.
  - Featured body có `justify-content: center` + `min-height: 360px`. Khi excerpt **ngắn** (1–2 dòng), body-inside vẫn fill full height (flex:1), excerpt nằm gần title, "Đọc tiếp" bị đẩy xuống đáy → tạo **khoảng trống lớn giữa excerpt và "Đọc tiếp"** → cảm giác "kéo giãn".
- **Root cause**:
  - Layout combine `min-height: 360px` + `justify-content: center` ở body + `margin-top: auto` ở read-more → khi nội dung text < height của ảnh, tạo gap thừa.
- **Risk nếu fix**:
  - Đổi spacing → ảnh hưởng các trang khác đang dùng `.wp-news-card-featured` (cần grep usage).
  - Phá visual hierarchy đang có nếu xoá `min-height`.
- **Safe fix direction**:
  - Bỏ `margin-top: auto` riêng cho variant featured, hoặc thay `justify-content: center` bằng `justify-content: flex-start` cho `.wp-news-card-featured .wp-news-body` để text bám đầu, "Đọc tiếp" bám sau excerpt theo gap tự nhiên.
  - Hoặc thêm CTA pill style cho read-more ở featured để gap trở thành intentional whitespace thay vì "trống".
  - Trước khi sửa: lấy 3–5 sample featured articles thực để xem excerpt length thực sự.
- **Không nên làm**:
  - Xoá variant featured.
  - Tách ArticleCard thành 2 component (over-engineering, structure hiện đang ổn).

---

### [F3] Excerpt fallback "Nội dung đang được cập nhật." hiển thị trên public

- **Status**: Confirmed
- **Severity**: P1
- **Evidence**:
  - File: [bigbike-web/components/content/ArticleCard.tsx#L14](../../bigbike-web/components/content/ArticleCard.tsx#L14)
  - Code:
    ```tsx
    const excerpt = safeText(article.excerpt, "Nội dung đang được cập nhật.");
    ```
  - `safeText` ([format.ts#L1-L7](../../bigbike-web/lib/utils/format.ts#L1-L7)) trả về fallback khi `value` rỗng/null/whitespace.
  - Backend contract: `Article.excerpt?: string` (optional) — backend cho phép bỏ trống ([public.ts#L242](../../bigbike-web/lib/contracts/public.ts#L242)).
  - Theo `MEMORY.md` ([project_blog_import_2026_05_11.md](../../../../Users/vomin/.claude/projects/s--project-bigbike/memory/project_blog_import_2026_05_11.md)): V93 import 167 bài WP — nhiều bài có khả năng cao thiếu excerpt vì WP cũ không bắt buộc.
- **Root cause**:
  - Excerpt là field optional trong CMS + import từ WP không guarantee có excerpt → frontend phải fallback → user thấy chuỗi placeholder rất unprofessional.
- **Risk nếu fix**:
  - Nếu xoá fallback hoàn toàn → layout grid sẽ vỡ height (do `.wp-news-excerpt { min-height: 104px }` giữ chỗ).
  - Nếu auto-generate từ body → cần strip HTML, cắt độ dài, có thể chứa shortcode WP → cần test với corpus thật.
- **Safe fix direction**:
  - **Phase 1 (frontend)**: Khi `excerpt` rỗng → auto-generate từ `article.body` (strip HTML, cắt ~160 ký tự, append `…`) **client-safe** hoặc trong SSR component. Vẫn giữ min-height để layout không vỡ.
  - **Phase 2 (CMS rule)**: Đề xuất bắt buộc excerpt khi publish ở admin (validation backend), nhưng đây là task riêng cho [bigbike-admin/](../../bigbike-admin/) — không scope của task này.
  - **Phase 3 (data backfill)**: Một script backfill excerpt cho 167 bài import — đây là task data, không UI.
- **Không nên làm**:
  - Xoá hoàn toàn excerpt field khỏi card (giảm SEO + giảm preview value).
  - Render `body` raw (mất line-clamp, vỡ HTML).
  - Đổi business contract `excerpt?` → `excerpt` (required) trong contract mà không qua docs review trước.

---

### [F4] Card grid spacing & equal height — duplicate CSS rules, min-height chưa cân

- **Status**: Partially confirmed
- **Severity**: P2
- **Evidence**:
  - **Duplicate definitions** trong cùng file `globals.css`:
    - `.wp-news-card`: định nghĩa lần 1 ở **L4061** và lần 2 ở **L5702**.
    - `.wp-news-card-title`: L4153 (font 0.88rem) **và** L5713 (font 18px). Source-order → L5713 thắng.
    - `.wp-news-excerpt`: L4171 (line-clamp 2) **và** L5715 (line-clamp 4, `min-height: 104px`). L5715 thắng.
    - `.wp-news-body-inside`: L4147 (`gap: 0.5rem`, không `flex: 1`) **và** L5711 (`gap: 8px`, `flex: 1`). L5711 thắng.
  - Line-clamp đã có:
    - Title: `-webkit-line-clamp: 2` (globals.css#L5713)
    - Excerpt: `-webkit-line-clamp: 4` + `min-height: 104px` (globals.css#L5715)
    - Featured title: `-webkit-line-clamp: 3` (globals.css#L5721)
  - Card body: `padding: 41px 20px 30px` — top 41px để chừa chỗ cho `.wp-news-date` (badge top:-21px height:42px overlap image/body).
  - Read-more: `margin-top: auto` (globals.css#L5716) đẩy về cuối → đảm bảo equal alignment of "Đọc tiếp" giữa các card cùng row.
  - Grid: `grid-template-columns: repeat(3, 1fr); gap: 22px` (desktop), `repeat(2, 1fr)` ở ≤768px, `1fr` ở ≤480px.
- **Root cause**:
  - Hai khối CSS cùng selector tồn tại song song trong globals.css → khó maintain, dễ regression khi sửa khối cũ.
  - Functional thì hiện tại "OK" vì khối sau (L5680+) override khối trước, nhưng nguy hiểm về dài hạn.
- **Risk nếu fix**:
  - Nếu chỉ xoá khối duplicate cũ (L4061-L4180) cẩu thả → mất rule mà chỉ khối cũ định nghĩa (ví dụ `.wp-news-img-placeholder` L4096–L4114).
  - Title 0.88rem (L4153) vs 18px (L5713) → khối nào thực sự intended? Cần xác định khi consolidate.
- **Safe fix direction**:
  - **Phase 1**: Không refactor CSS. Chỉ verify rằng L5680+ là intended (likely yes, vì nó là khối `.wp-news-page` scoped block — full module).
  - **Phase 2 (refactor riêng)**: Audit duplicate trong globals.css (10000+ dòng), gộp về 1 khối canonical. Đây là task lớn hơn `/tin-tuc/`, **không nên** ép vào fix UI ngay.
  - Nếu cần điều chỉnh nhỏ (gap, min-height excerpt) → sửa khối L5680+ là đủ.
- **Không nên làm**:
  - Refactor toàn bộ `.wp-news-*` CSS trong PR này.
  - Đổi line-clamp logic vì hiện đã có và hoạt động đúng.

---

### [F5] Ảnh cover bài viết chưa đồng bộ (crop / aspect / text-in-image)

- **Status**: Not confirmed via code (CSS đúng spec, vấn đề ở **content asset**)
- **Severity**: P2 (nếu thực sự ảnh hưởng UX)
- **Evidence**:
  - CSS đã set `aspect-ratio: 16 / 9; overflow: hidden;` cho `.wp-news-img-wrap` (L5704) → tất cả ảnh hiển thị đúng tỉ lệ 16:9.
  - `.wp-news-img { object-fit: cover }` (L5705) → ảnh fill khung, crop phần thừa.
  - `MediaImage` ([MediaImage.tsx#L34-L41](../../bigbike-web/components/ui/MediaImage.tsx#L34-L41)) dùng `next/image` với `width={1200} height={675}` (16:9). Nếu ảnh nguồn không có cover hoặc URL invalid → fallback `<div class="bb-image-fallback">` (text-only) → đây có thể là nguyên nhân "ảnh không đồng bộ" nếu một số bài thiếu `coverImage`.
- **Root cause** (giả định):
  - Vấn đề ảnh nguồn (asset từ CMS / import WP): một số ảnh có watermark, một số có text overlay sẵn, một số bị crop center mất focal point.
  - CSS hiện tại xử lý đúng — không phải bug code.
- **Risk nếu fix**:
  - Đổi `object-fit` hoặc `object-position` → có thể fix 1 ảnh nhưng phá ảnh khác.
- **Safe fix direction**:
  - **Đây không phải code fix**. Cần content audit: ai trong shop review lại 167 ảnh import từ WP, đặt featured image proper, có thể thêm trường `focalPoint` ở CMS sau (lớn hơn scope).
  - Tạm thời: không can thiệp.
- **Không nên làm**:
  - Đổi `object-fit: cover` thành `contain` → tạo viền đen quanh ảnh, vỡ visual.
  - Đổi aspect ratio → ảnh hưởng SEO image dimensions, og:image.

---

### [F6] Hero hơi template / contrast / hierarchy

- **Status**: Partially confirmed
- **Severity**: P3 (preference, không bug)
- **Evidence**:
  - Component: [bigbike-web/components/layout/PageHero.tsx](../../bigbike-web/components/layout/PageHero.tsx).
  - Khi không có `imageUrl` custom (heroSettings không có `hero_news`) → fallback `/wp/page-title-bg.png` + thêm `wp-cat-hero--wp` modifier → ẩn overlay đen, render thêm illustration `/wp/mu-bao-hiem.png` ở góc phải (helmet).
  - Trang `/tin-tuc/` truyền `heroSettings.imageUrl` từ public settings key `hero_news` ([tin-tuc/page.tsx#L121](../../bigbike-web/app/tin-tuc/page.tsx#L121)). Nếu admin chưa set → dùng fallback WP — **đúng là cùng background với các trang khác cũng đang fallback**.
  - CSS hero ([globals.css#L4548-L4561, L7311-L7355](../../bigbike-web/app/globals.css)) có hierarchy: kicker (11px brand color) → breadcrumb (11px muted) → title (clamp 2–3.2rem) → desc (13px) → count badge (11px brand-soft).
  - **Vấn đề thực sự**: nếu admin **chưa upload** ảnh hero cho `hero_news`, hero sẽ trông giống mọi trang fallback khác (cùng background image, cùng illustration helmet) → cảm giác template.
- **Root cause**:
  - Thiếu **content** (admin chưa setup ảnh hero riêng cho mục Tin tức), không phải bug code.
  - Heuristic: helmet illustration có thể không phù hợp cho trang Tin tức (về kiến thức/blog), nhưng đó là choice design ban đầu áp dụng cho mọi fallback page.
- **Risk nếu fix**:
  - Bỏ illustration cho `/tin-tuc/` → tạo inconsistency với các trang fallback khác (`/lien-he/`, `/gioi-thieu/`...).
  - Đổi background gradient/contrast → tốn time + có thể trùng với task typography sau này.
- **Safe fix direction**:
  - **Phase 1 (content)**: Upload ảnh hero riêng cho `hero_news` qua admin → fallback không còn được dùng cho trang này.
  - **Phase 2 (code, optional)**: Nếu muốn unify với WP cũ nhiều hơn, kiểm tra style hierarchy với WP reference screenshot và tinh chỉnh font-size kicker/title/desc — phải so sánh side-by-side, không sửa mò.
- **Không nên làm**:
  - Đổi `PageHero` API contract.
  - Bỏ fallback `/wp/page-title-bg.png` (sẽ vỡ các trang khác).
  - Tăng heading lên H1 thứ 2 (đã có 1 H1 trong hero).

---

### [F7] Floating chat/support đè nội dung

- **Status**: Needs runtime data
- **Severity**: P2
- **Evidence**:
  - Component: `<FloatingChat>` mount qua `<FloatingChatLoader>` trong [app/layout.tsx#L90-L92](../../bigbike-web/app/layout.tsx#L90-L92), wrap trong `div.wp-floating-group`.
  - CSS `.wp-floating-group` ([globals.css#L361-L374](../../bigbike-web/app/globals.css#L361-L374)):
    ```css
    .wp-floating-group {
      position: fixed;
      bottom: max(24px, env(safe-area-inset-bottom));
      right: max(24px, env(safe-area-inset-right));
      z-index: var(--bb-z-overlay);
      display: flex; flex-direction: column; align-items: flex-end; gap: 12px;
      pointer-events: none;
    }
    .wp-floating-group > * { pointer-events: auto; }
    ```
  - Button 56×56 (desktop) / 52×52 (mobile ≤480px). Label "Bạn cần hỗ trợ?" hiển thị bên trái button ở desktop, ẩn ở ≤480px (L6281).
  - **Pagination** (`.bb-pagination`) có `margin-top: var(--bb-space-6)` (L1119) và không phải fixed → cuộn được. Khi cuộn đến cuối, pagination ở vị trí gần `bottom-right` chính là chỗ chat float. Vì chat fix bottom 24px + height 56px → vùng chiếm dọc ~80px ở góc dưới phải; trên mobile có thể đè lên Trang sau button khi viewport hẹp.
  - **Featured card** không bị đè ở normal viewport (hero + section section đẩy featured ra giữa trang).
- **Root cause** (suspected, chưa confirm runtime):
  - Trên mobile ≤480px, pagination flex-wrap có thể đẩy "Trang sau" vào cùng line với chat fab → đè.
  - Trên desktop, label "Bạn cần hỗ trợ?" có thể che meta/text gần edge phải ở các card cuối grid khi viewport ≤1024px chưa đủ rộng để có padding hai bên.
- **Risk nếu fix**:
  - Tăng padding-bottom của trang → ảnh hưởng các trang khác nếu set global.
  - Đổi `z-index` → ảnh hưởng modal/toast.
- **Safe fix direction**:
  - **Phase 1 (verify)**: Cần screenshot/mobile devtools test thực:
    - 1440px / 1024px / 768px / 414px (iPhone) / 360px.
    - Kiểm tra `bb-pagination` bottom có cách `wp-floating-group` đủ 80px+ không.
  - **Phase 2 (nếu confirm)**: Thêm `padding-bottom: 96px` cho `.wp-news-page` ở mobile, hoặc `scroll-padding-bottom`. Đây là fix scoped, không ảnh hưởng trang khác.
- **Không nên làm**:
  - Đổi position chat từ `fixed` → `absolute` (mất tính năng follow scroll).
  - Bỏ chat trên trang `/tin-tuc/` (business cần chat luôn available).
  - Đổi `z-index` token global.

---

### [F8] Pagination visual chưa đồng bộ

- **Status**: Confirmed
- **Severity**: P2
- **Evidence**:
  - Component: [bigbike-web/components/ui/PaginationNav.tsx](../../bigbike-web/components/ui/PaginationNav.tsx).
  - **Prev/Next** dùng `className="bb-button bb-button-secondary"` (L31, L35, L58, L62) → kế thừa style từ `.bb-button` (globals.css#L539): `min-height: 2.75rem` (44px), `padding: 0 var(--bb-space-5)`, `font-weight: 900`, `letter-spacing: 0.08em`, `text-transform: uppercase`, border radius `var(--bb-radius-button)`.
  - **Page numbers** dùng `className="bb-pagination-page"` (L46) → style từ `.bb-pagination-page` (globals.css#L1139): `min-width: 36px; height: 36px; padding: 0 6px; border-radius: var(--bb-radius-sm); font-size: 13px;` — **height 36px (vs 44px của button), font-weight default (vs 900), no uppercase, không letter-spacing**.
  - Active page dùng background brand-primary đỏ (đậm) — visually giống primary button, trong khi prev/next là secondary (outline) → **3 visual treatments khác nhau** trong cùng pagination bar.
  - Disabled prev/next dùng `<button disabled>` thay cho Link → cùng `.bb-button.bb-button-secondary` class nhưng opacity 0.52 → vẫn cùng style với active nav button.
  - Responsive: trên `(pointer: coarse) or max-width 768px` (L6238-L6252) — `.bb-pagination-page` được tăng `min-width/min-height: var(--bb-touch-target)` (44px) — fix touch target. Prev/Next đã có min-height 44px sẵn.
- **Root cause**:
  - 2 component class hệ khác nhau: `.bb-button*` (action button) cho prev/next, `.bb-pagination-page` (pagination pill) cho số trang. Không có rule chung khiến hai item visually liên quan.
- **Risk nếu fix**:
  - Đổi prev/next sang style match page number → mất affordance "button hành động chính" và có thể giảm clickability cảm nhận.
  - Đổi pagination-page sang button style → cồng kềnh, mỗi số trang to bằng button → overflow trên mobile.
- **Safe fix direction**:
  - Cách đơn giản: **giữ kiểu nhưng đồng bộ height/typography**:
    - `.bb-pagination .bb-button-secondary` → giảm padding, height 36px (match page number) hoặc:
    - `.bb-pagination-page` → tăng letter-spacing/uppercase nếu muốn tinh tế hơn.
  - Hoặc tạo variant `.bb-pagination-nav` cho prev/next, mang style giống page number với chỉ +icon (← / →).
  - **Không thay đổi logic `buildPageList`** ([PaginationNav.tsx#L9-L21](../../bigbike-web/components/ui/PaginationNav.tsx#L9-L21)) — chỉ đụng presentation.
- **Không nên làm**:
  - Đổi structure HTML pagination (a/button/span ratio đang hợp lý cho a11y).
  - Đổi route building (`makeHref`).
  - Thêm "First/Last" page button (out of scope).

---

## Fix Plan Đề Xuất

### Phase 1 — Low-risk UI polish (CSS + nhỏ, scoped vào `/tin-tuc/`)

1. **F1 (partial)**: Đổi `<input name="category">` thành `<select>` populated từ `categories` đã derive. Giữ chip strip. Không đổi backend.
2. **F3 (partial)**: Thay fallback excerpt bằng auto-generated từ `body` (strip HTML + truncate). Vẫn giữ string fallback final nếu body cũng rỗng.
3. **F8**: Đồng bộ visual giữa prev/next và page-number — chọn 1 trong 2 hướng đã đề xuất.
4. **F4**: KHÔNG refactor duplicate CSS. Chỉ chạm rule cụ thể nếu Phase 1 yêu cầu.

### Phase 2 — Layout / data audit

5. **F2**: Sau khi có data thực (excerpt length), điều chỉnh featured layout: bỏ `justify-content: center` hoặc thêm CTA pill cho "Đọc tiếp".
6. **F7**: Runtime test pagination vs chat fab ở ≤768px, thêm `padding-bottom` cho `.wp-news-page` nếu cần.
7. **F5**: Content audit ảnh cover (167 bài WP import) — không phải code task.

### Phase 3 — Optional / cross-cutting (PR riêng)

8. **F1 (full)**: Backend thêm `GET /api/v1/articles/categories` (cần update `API_CONTRACT.md` trước, theo Docs-First Contract). Frontend prefetch full list cho dropdown + chip.
9. **F6**: Tinh chỉnh hero hierarchy & upload ảnh `hero_news` riêng từ admin.
10. Refactor duplicate CSS trong `globals.css` (audit toàn file).

---

## Files likely to change (chưa sửa)

| Phase | File | Tại sao |
|---|---|---|
| 1 | [bigbike-web/app/tin-tuc/page.tsx](../../bigbike-web/app/tin-tuc/page.tsx) | Đổi input `category` → select (F1) |
| 1 | [bigbike-web/components/content/ArticleCard.tsx](../../bigbike-web/components/content/ArticleCard.tsx) | Excerpt fallback từ body (F3) |
| 1 | [bigbike-web/app/globals.css](../../bigbike-web/app/globals.css) | Pagination visual sync (F8); featured layout (F2) |
| 1 | [bigbike-web/lib/utils/format.ts](../../bigbike-web/lib/utils/format.ts) | Helper strip-html + truncate cho excerpt (F3), nếu chưa có |
| 2 | [bigbike-web/app/globals.css](../../bigbike-web/app/globals.css) | Padding-bottom cho `/tin-tuc/` mobile (F7) |
| 3 (riêng PR) | [bigbike-web/lib/api/public-api.ts](../../bigbike-web/lib/api/public-api.ts) | `listArticleCategories()` (F1 full) |
| 3 (riêng PR) | [docs/engineering/API_CONTRACT.md](../engineering/API_CONTRACT.md) | Update endpoint mới (F1 full) — **trước** code |
| 3 (riêng PR) | [bigbike-backend/...](../../bigbike-backend/) | Public categories controller (F1 full) |

---

## Acceptance Criteria (cho task fix sau này)

### F1 — Filter UX
- [ ] Trên `/tin-tuc/`, field "Danh mục" không còn là input text trống → user pick được category từ control (select/dropdown hoặc chip strip prominent).
- [ ] Submit form vẫn gửi query param `?category=<slug>` đúng.
- [ ] Khi không có category nào trong page hiện tại → field/strip vẫn render hợp lý (không vỡ layout).
- [ ] Reset filter ("Xoá lọc") vẫn xoá category param.

### F2 — Featured layout
- [ ] Featured card không có khoảng trống >40px giữa excerpt và "Đọc tiếp" khi excerpt 1-2 dòng.
- [ ] Ảnh cover vẫn chiếm ~58% width, body ~42% (tỷ lệ hiện tại 1.25fr / 0.75fr).
- [ ] Trên mobile ≤1024px, featured chuyển sang stack 1 cột — vẫn equal alignment với grid bên dưới.

### F3 — Excerpt fallback
- [ ] Khi `article.excerpt` rỗng nhưng `article.body` có nội dung → card hiển thị **first ~160 ký tự** của body (đã strip HTML) thay vì "Nội dung đang được cập nhật."
- [ ] Khi cả excerpt + body đều rỗng → vẫn render fallback (rare case, đảm bảo layout không vỡ).
- [ ] Min-height excerpt giữ 104px để cards alignment đồng đều.

### F4 — Grid spacing
- [ ] Các card cùng row có "Đọc tiếp" align cùng baseline.
- [ ] Title line-clamp 2 vẫn hoạt động đúng (không vỡ với title 4+ dòng).
- [ ] Excerpt line-clamp 4 vẫn hoạt động đúng.

### F5 — Cover ảnh
- [ ] (Content task) 167 bài WP import có cover image đặt đúng focal point, không có watermark legacy.
- [ ] CSS `object-fit: cover` + `aspect-ratio: 16/9` giữ nguyên.

### F6 — Hero
- [ ] Admin đã upload ảnh hero riêng cho key `hero_news` (content task).
- [ ] Hero hiển thị: kicker → breadcrumb → title → desc → meta theo thứ tự visual rõ ràng.
- [ ] Title không bị overlap helmet illustration ở viewport 1024–1440px.

### F7 — Floating chat
- [ ] Tại viewport 360px, 414px, 768px: button "Trang sau" của pagination cách chat fab tối thiểu 16px.
- [ ] Label "Bạn cần hỗ trợ?" không che meta/text của card ở góc dưới phải ở mọi viewport.
- [ ] Z-index chat không vượt header/modal/toast.

### F8 — Pagination visual
- [ ] Prev/Next button và page-number pill có same height visual (cùng 36px hoặc cùng 44px, **không** mismatch).
- [ ] Active page giữ highlight brand-primary.
- [ ] Touch target ≥44px ở mobile/coarse pointer.
- [ ] Logic `buildPageList` không đổi: ellipsis xuất hiện khi tổng trang > 7 và current page cách đầu/cuối > 3.

---

## Ràng buộc đã verify đang được giữ (không vi phạm)

- ✅ SEO `noIndex` khi có filter (`page > 1 || q || category || sort`) — [page.tsx#L60-L71](../../bigbike-web/app/tin-tuc/page.tsx#L60-L71).
- ✅ Canonical path `toArticleListPath()` luôn được set.
- ✅ Query params shape: `q`, `category`, `sort`, `page`, `size` — đầy đủ parse & validate qua [lib/utils/query.ts](../../bigbike-web/lib/utils/query.ts).
- ✅ Pagination `buildPageList` đúng spec (7 trang inline, ellipsis khi cần).
- ✅ API contract `/api/v1/articles` không đổi.
- ✅ Backend public endpoint cho article-categories **chưa có** — không bịa, ghi nhận trong Phase 3.

---

## Khuyến nghị tiếp theo

- **Trước khi code fix bất kỳ finding nào**, hỏi user pick: chỉ Phase 1, hay Phase 1+2 (CSS only), hay full Phase 1–3 (chạm backend + docs)?
- F1 full + F6 đụng vào **docs business/engineering** (API contract, hero setting), phải **update docs trước** theo Docs-First Contract — không "code-first, doc-fix-later".
- F5 không phải code task — đề nghị tách thành ticket content audit riêng cho team CMS/marketing.
