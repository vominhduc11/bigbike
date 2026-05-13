# BigBike Web News Page — Phase 1 Fix Report

**Ngày**: 2026-05-13
**Dựa trên**: [BIGBIKE_WEB_NEWS_PAGE_PRE_FIX_VERIFICATION.md](./BIGBIKE_WEB_NEWS_PAGE_PRE_FIX_VERIFICATION.md)
**Phạm vi**: Phase 1 only — F1 partial, F3, F8

---

## Files Changed

| File | Thay đổi |
|---|---|
| [bigbike-web/components/content/ArticleCard.tsx](../../bigbike-web/components/content/ArticleCard.tsx) | F3 — thêm 3 helpers, thay excerpt fallback |
| [bigbike-web/app/tin-tuc/page.tsx](../../bigbike-web/app/tin-tuc/page.tsx) | F1 — category input → select |
| [bigbike-web/components/ui/PaginationNav.tsx](../../bigbike-web/components/ui/PaginationNav.tsx) | F8 — thay Button shadcn → link/button native với `.bb-pagination-nav` |
| [bigbike-web/app/globals.css](../../bigbike-web/app/globals.css) | F8 — thêm `.bb-pagination-nav` rule + touch target media query |

---

## F1 — Category Input → Select

### Vấn đề cũ
Field "Danh mục" là `<Input>` (shadcn) cho user tự gõ slug (`tin-tuc`, `huong-dan`…). UX developer, không phải end-user.

### Cách fix
Đổi thành `<select name="category" className="wp-input">` (match với `<select name="sort">` đã có trong cùng form):

```tsx
<select name="category" defaultValue={categoryParsed.value ?? ""} className="wp-input">
  <option value="">Tất cả danh mục</option>
  {/* ghost option khi active category không có trong trang hiện tại */}
  {categoryParsed.value && !categories.some((c) => c.slug === categoryParsed.value) ? (
    <option value={categoryParsed.value}>Danh mục hiện tại: {categoryParsed.value}</option>
  ) : null}
  {categories.map((c) => (
    <option key={c.id} value={c.slug}>{c.name}</option>
  ))}
</select>
```

- Options derive từ `collectArticleCategories(articles)` (12 bài hiện tại).
- Ghost option giữ state khi filter bằng URL trực tiếp với category không xuất hiện trong trang hiện tại.
- Query param `?category=<slug>` không thay đổi — submit form GET vẫn đúng.
- Chip strip bên dưới không bị ảnh hưởng.

### Limitations còn lại (Phase 3)
Backend chưa có `GET /api/v1/articles/categories` — select chỉ hiển thị categories từ 12 bài đang render, không phải toàn bộ. Fix đầy đủ cần Phase 3 (thêm backend endpoint + update `API_CONTRACT.md` trước).

---

## F3 — Excerpt Fallback → Auto-Generate từ Body

### Vấn đề cũ
```tsx
const excerpt = safeText(article.excerpt, "Nội dung đang được cập nhật.");
```
Hiển thị chuỗi placeholder unprofessional trên public card khi bài thiếu excerpt (đặc biệt 167 bài WP import).

### Cách fix
Thêm 3 helper functions trong `ArticleCard.tsx`:

```ts
function stripHtmlToText(html: string): string {
  // Strip HTML tags, decode common entities (&nbsp; &amp; &lt; &gt; &quot; &#39;),
  // collapse whitespace
}

function truncateText(text: string, maxLength = 160): string {
  // Cắt tại word boundary gần nhất nếu trong 30 ký tự cuối,
  // hoặc cắt hard tại maxLength. Append "…".
}

function resolveArticleExcerpt(article: Article): string {
  // 1. Dùng excerpt nếu có
  // 2. Generate từ body (strip HTML + truncate)
  // 3. Fallback "Xem chi tiết bài viết từ BigBike." nếu body cũng rỗng
}
```

Thay:
```tsx
const excerpt = safeText(article.excerpt, "Nội dung đang được cập nhật.");
```
Bằng:
```tsx
const excerpt = resolveArticleExcerpt(article);
```

- Min-height excerpt (104px) giữ nguyên → layout không vỡ.
- `safeText` import giữ nguyên (vẫn dùng cho `title` và `category`).
- Fallback cuối "Xem chi tiết bài viết từ BigBike." ít placeholder hơn và có tính thương hiệu.

---

## F8 — Pagination Visual Sync

### Vấn đề cũ
Prev/Next dùng shadcn `Button variant="secondary"` (min-height 44px, `bg-white border-2 border-primary text-primary`) trông hoàn toàn khác page-number pills (height 36px, `border border-border/60 text-muted`).

### Cách fix

**`PaginationNav.tsx`** — Thay `<Button asChild>` bằng `<Link>`/`<button>` native sử dụng class mới `.bb-pagination-nav`:

```tsx
// Trước:
<Button asChild variant="secondary"><Link href={...}>Trang trước</Link></Button>
<Button variant="secondary" disabled>Trang trước</Button>

// Sau:
<Link href={...} className="bb-pagination-nav">Trang trước</Link>
<button disabled className="bb-pagination-nav">Trang trước</button>
```

Rationale: Page numbers đã dùng `.bb-pagination-page` (legacy CSS trong same context). Thêm `.bb-pagination-nav` cho prev/next giữ nhất quán trong pagination block, không touch global `Button` styles.

**`globals.css`** — Thêm `.bb-pagination-nav` sau `.bb-pagination-ellipsis`:

```css
.bb-pagination-nav {
  display: inline-flex; align-items: center; justify-content: center;
  height: 36px; padding: 0 14px;
  border-radius: var(--bb-radius-sm); border: 1px solid var(--bb-border-subtle);
  color: var(--bb-text-secondary); font-size: 13px;
  text-decoration: none; background: transparent; cursor: pointer;
  white-space: nowrap; transition: all 140ms;
}
.bb-pagination-nav:hover:not(:disabled) { border-color: var(--bb-border-brand); color: var(--bb-text-brand); }
.bb-pagination-nav:disabled { opacity: 0.52; cursor: not-allowed; }
```

**Touch target** — Thêm `.bb-pagination-nav` vào media query coarse/mobile:
```css
@media (pointer: coarse), (max-width: 768px) {
  .bb-pagination-page,
  .bb-pagination-nav,  /* ← added */
  ... { min-width: var(--bb-touch-target); min-height: var(--bb-touch-target); }
}
```

Desktop: prev/next 36px = page numbers 36px.
Mobile: prev/next + page numbers đều tăng lên `var(--bb-touch-target)` (44px).

---

## Những gì cố ý KHÔNG làm trong Phase 1

| Item | Lý do |
|---|---|
| Không thêm public `GET /api/v1/articles/categories` | Cần update `API_CONTRACT.md` trước (Docs-First Contract) → Phase 3 riêng |
| Không refactor duplicate CSS `.wp-news-*` trong globals.css | Scope lớn hơn `/tin-tuc/`, task riêng |
| Không fix F2 (featured layout kéo giãn) | Cần sample data thực → Phase 2 |
| Không fix F5 (ảnh cover không đồng bộ) | Content task, không phải code |
| Không fix F6 (hero hero hierarchy) | Admin cần upload ảnh `hero_news` → content task |
| Không fix F7 (floating chat mobile) | Cần runtime screenshot ≤480px để confirm trước khi fix |
| Không đổi `generateMetadata`, canonical, `noIndex` logic | Không liên quan Phase 1 |
| Không đổi query params `q`, `category`, `sort`, `page`, `size` | Giữ nguyên URL contract |
| Không đổi global `Button` styles | Scoped fix cho pagination context only |
| Không đổi `listArticles` API call | Không liên quan Phase 1 |

---

## Test Results

| Check | Result |
|---|---|
| `tsc --noEmit` | ✅ Clean (no errors) |
| `npm run build` | ✅ Clean build — `/tin-tuc` route renders, 97 article paths generated |
| Build warnings | ⚠️ Pre-existing: "Next.js inferred workspace root" — không liên quan |

**Routes verified tại build time:**
- `/tin-tuc` — Dynamic (ƒ) — renders đúng
- `/tin-tuc/[slug]` — SSG (●) — 100 paths generated (97 + 3 sample)

---

## Remaining Risks

| Risk | Mức độ | Ghi chú |
|---|---|---|
| Select category chỉ hiện categories từ 12 bài hiện tại | Low | Expected limitation, user thấy chip strip nếu cần navigate — cần Phase 3 để fix đầy đủ |
| WP body có shortcode `[gallery id=1]` vẫn xuất hiện sau strip HTML | Low | Rare, shortcode text không phá layout. Data cleanup là solution đúng |
| Ghost option "Danh mục hiện tại: tin-tuc" hơi technical | Low | Chỉ render khi filter via URL direct với slug ngoài trang hiện tại — edge case |
| `.bb-pagination-nav` mixed với Tailwind context | Low | Scoped trong pagination block, cùng pattern với `.bb-pagination-page` đã có |
| F7 floating chat đè pagination trên mobile | Medium | Chưa có runtime confirm — cần visual test ≤480px trước Phase 2 |
