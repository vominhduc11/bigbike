# Báo cáo Audit Typography System — BigBike Monorepo

**Phạm vi:** `bigbike-web` (Next.js 15) · `bigbike-admin` (React + Vite)  
**Nguồn tham chiếu:** `bigbike-web/docs/TYPOGRAPHY.md` · `bigbike-web/STYLEGUIDE.md` · `bigbike-admin/src/styles/admin-tokens.css` · CLAUDE.md  
**Ngày audit:** 2026-05-30

---

## Tổng quan nhanh

| Nhóm | web trạng thái | admin trạng thái |
|---|---|---|
| 1. Font family | ⚠️ Token đúng, 2 component dùng sai token | 🔴 CLAUDE.md mandates Bungee+Exo; code thực tế dùng Inter |
| 2. Font weight | ⚠️ `font-extrabold` (800) không có token | ✅ Dùng Tailwind trực tiếp, nhất quán |
| 3. Line height | ⚠️ Token `--bb-line-heading: 1.5` mâu thuẫn docs; nhiều arbitrary | ⚠️ Không có `--admin-line-*` tokens; hardcode trực tiếp |
| 4. Letter spacing | 🔴 Hoàn toàn không tokenized; >10 giá trị arbitrary khác nhau | 🔴 Không tokenized; mix giữa CSS raw và Tailwind arbitrary |
| 5. Text alignment | ✅ Dùng Tailwind utility contextual, không vấn đề | ✅ Idem |
| 6. Text transform | ✅ Nhất quán `uppercase` + `normal-case` override | ✅ Nhất quán |
| 7. Text decoration | ⚠️ Không tokenized; underline chỉ implicit | ⚠️ Idem |
| 8. Font style | ✅ Chỉ italic trong richtext — đúng | ✅ Idem |
| 9. Text overflow / truncate | ⚠️ Mix Tailwind `truncate` và CSS `text-overflow: ellipsis` raw | ⚠️ Idem |
| 10. Word break / wrapping | ✅ Dùng Tailwind; một vài raw CSS | ⚠️ `word-break: break-word` trong CSS, Tailwind trong JSX |
| 11. Paragraph spacing | ⚠️ Chỉ trong richtext; không token | ⚠️ Không token; hardcode em |
| 12. Text shadow | ⚠️ Một chỗ duy nhất, không token, arbitrary Tailwind | ✅ Không dùng |
| 13. Responsive typography | 🔴 Web vi phạm quy tắc "no breakpoint overrides"; nhiều hardcoded px | ⚠️ Fixed size, 2-3 breakpoint target nhỏ |
| 14. Heading hierarchy h1–h6 | ⚠️ HeroSlider h2 có thể conflict với page h1 | 🔴 Admin skip level: h4 mà không có h2/h3 cha |

**Legend:** ✅ Tốt · ⚠️ Cần chú ý · 🔴 Vấn đề nghiêm trọng

---

## 1. Font Family

### bigbike-web

**Nguồn token** — `bigbike-web/styles/brand-tokens.css` lines 114–119:

```css
--bb-font-display: var(--font-barlow-condensed), "Barlow Condensed", ...
--bb-font-heading: var(--font-barlow-condensed), "Barlow Condensed", ...
--bb-font-body:    var(--font-barlow), "Barlow", ...
--bb-font-link:    var(--font-barlow), "Barlow", ...
--bb-font-cta:     var(--font-barlow-condensed), "Barlow Condensed", ...
--bb-font-nav:     var(--font-barlow-condensed), "Barlow Condensed", ...
```

**Tailwind exposure** — `globals.css` `@theme inline`:
```
--font-display → Barlow Condensed
--font-body    → Barlow
--font-heading → Barlow Condensed
--font-cta     → Barlow Condensed
```

**Loading** — `app/fonts.ts`: Barlow (weights 400/500/600/700), Barlow Condensed (weights 500/600/700) via `next/font/google`.

**Sử dụng đúng:**
- `PageHero.tsx`: `font-display` (h1) ✅
- `card.tsx` CardTitle: `font-heading` ✅
- `button.tsx`: `font-cta` ✅
- `MobileSectionHeader.tsx`: `font-display` (h2) + `font-cta` (kicker) ✅

**Vấn đề phát hiện:**

| File | Vấn đề |
|---|---|
| `SiteFooter.tsx:260` | `<p>` dùng không khai báo `font-body` — inherit từ body, đúng về hiệu quả nhưng không explicit |
| `HeaderNavItem.tsx:43,54,82,139,167` | Dùng `font-heading` cho nav items — token đúng là `font-nav` theo docs |
| `HomeVideoCarousel.tsx:365` | `<p>` slide title dùng `font-display` — semantic nên là `font-body` |

**Đề xuất chuẩn hóa:**
- Thống nhất nav items về `font-nav` (hiện đang dùng `font-heading` — cùng Barlow Condensed nhưng sai intent)
- Add `font-nav` vào `@theme inline` nếu chưa có để Tailwind expose utility

---

### bigbike-admin

**Nguồn token** — `admin-tokens.css` lines 72–75:

```css
--admin-font-body:    Inter, system-ui, -apple-system, sans-serif;
--admin-font-display: Inter, system-ui, sans-serif;
--admin-font-mono:    'JetBrains Mono', ui-monospace, 'Cascadia Code', monospace;
```

**Loading** — `main.jsx` lines 7–14: `@fontsource/inter` (400/500/600/700/800) + `@fontsource/jetbrains-mono` (400/500).

**🔴 CRITICAL — Mâu thuẫn CLAUDE.md vs code thực tế:**

CLAUDE.md mandates:
> Font → **Bungee** (display/headline, uppercase only), **Exo** (body/UI/content)

Code thực tế:
> `--admin-font-body: Inter` · `--admin-font-display: Inter` · mono: JetBrains Mono

Bungee và Exo **không được import** ở bất kỳ đâu trong `bigbike-admin`. CLAUDE.md đang document target state chưa implement hoặc đã thay đổi mà docs chưa update.

**Đề xuất:** Xác nhận với team quyết định cuối cùng — nếu Inter là final thì update CLAUDE.md; nếu Bungee+Exo là target thì cần migration plan rõ ràng.

**Sử dụng đúng trong code hiện tại:**
- `body { font-family: var(--admin-font-body) }` ✅
- `index.css @theme inline`: `--font-body: var(--admin-font-body)` ✅
- `--font-display: var(--admin-font-display)` ✅
- `Toaster` trong main.jsx: `fontFamily: 'Inter, system-ui, sans-serif'` — hardcode thay vì token ⚠️

**Vấn đề thêm:**
- `NewsletterSubscribersScreen.jsx:51`: dùng `text-[var(--bb-brand)]` — token của `bigbike-web` leak vào `bigbike-admin` 🔴

---

## 2. Font Weight

### bigbike-web

**Token:** `brand-tokens.css` lines 181–184:
```css
--bb-font-weight-regular:  400
--bb-font-weight-medium:   500
--bb-font-weight-semibold: 600
--bb-font-weight-bold:     700
```

**Sử dụng Tailwind (mapping từ token):**

| Tailwind class | Weight | Dùng ở |
|---|---|---|
| `font-normal` (400) | Regular | `input.tsx`, body text |
| `font-medium` (500) | Medium | `label.tsx`, form helpers |
| `font-semibold` (600) | Semibold | Headings, buttons, badges — **phổ biến nhất** |
| `font-bold` (700) | Bold | `PageHero.tsx` h1, kicker |
| `font-extrabold` (800) | — | `HomeVideoCarousel.tsx:80` |

**Vấn đề:**
- `font-extrabold` (800) được dùng trong `HomeVideoCarousel.tsx:80` nhưng **không có token** tương ứng — Barlow Condensed được load tối đa weight 700
- `app/fonts.ts` chỉ load Barlow (400/500/600/700) và Barlow Condensed (500/600/700); weight 800 sẽ fallback về synthetic bold

**Đề xuất:** Thay `font-extrabold` → `font-bold` tại `HomeVideoCarousel.tsx:80`; hoặc add weight 800 vào font loading nếu design intent thực sự cần.

---

### bigbike-admin

Không có `--admin-font-weight-*` tokens. Dùng Tailwind trực tiếp:
- `font-medium` (500): labels, nav links, info-grid values
- `font-semibold` (600): modal titles, card heads, mobile card title
- `font-bold` (700): table headers, summary card values, form labels

**Nhận xét:** Admin không cần token font-weight riêng vì Inter dùng Tailwind standard weights — nhất quán. ✅ Tuy nhiên nếu chuyển sang Exo/Bungee, cần kiểm tra weight support.

---

## 3. Line Height

### bigbike-web

**Tokens:**
```css
--bb-line-heading:       1.5   /* brand-tokens.css line 186 */
--bb-line-body:          1.5   /* brand-tokens.css line 187 */
--bb-line-section-title: 1.2
--bb-line-section-kicker: 19px  /* px — không phải ratio */
--bb-line-news-title:    24px   /* px — không phải ratio */
--bb-line-product-title: 20px   /* px — không phải ratio */
--bb-line-footer-slogan: 1.2
```

**⚠️ Mâu thuẫn token vs docs:**  
`--bb-line-heading: 1.5` nhưng `docs/TYPOGRAPHY.md` master type scale quy định:
- Display/H1: **1.0–1.1**
- H2: **1.15**
- H3–H6: **1.2**

Token `1.5` dành cho body, không phải heading — đây là lỗi token naming hoặc giá trị sai.

**⚠️ px line-height trong tokens:**  
`--bb-line-section-kicker: 19px` và `--bb-line-news-title: 24px` là px tuyệt đối — vi phạm quy tắc WCAG "dùng rem" cho typography. Nếu user scale font lên 24px thì line-height 19px sẽ nhỏ hơn font size.

**Arbitrary values trong components:**

| File | Value | Vấn đề |
|---|---|---|
| `HomeVideoCarousel.tsx:90` | `leading-[1.4]`, `leading-[1.45]`, `leading-[1.12]` | Không từ token |
| `ArticleCard.tsx` | `leading-[1.12]`, `leading-[1.65]` | Không từ token |
| `ProductCard.tsx:234` | `leading-[1.08]` | Không từ token |
| `PageHero.tsx` h1 | `leading-tight` (Tailwind 1.25) | Không dùng fluid token |
| `card.tsx` CardTitle | `leading-tight` | Idem |

**Tailwind standard dùng đúng:** `leading-relaxed` (FAQ content), `leading-normal` (product descriptions) — phù hợp docs.

**Đề xuất:**
- Sửa `--bb-line-heading` → `1.1` (match docs)
- Đổi `--bb-line-section-kicker` và `--bb-line-news-title` từ px → unitless ratio
- Tokenize các giá trị hay dùng: `--bb-line-tight: 1.08`, `--bb-line-snug: 1.2`

---

### bigbike-admin

**Không có `--admin-line-*` tokens.** Tất cả hardcode trực tiếp trong CSS:

| Selector | Value | File |
|---|---|---|
| `body` | `1.5` | `index.css:103` |
| `.tiptap p` | `1.65` | `index.css` |
| `.tiptap h2` | `1.25` (từ browser default) | `index.css` |
| `.summary-card-value` | `1.15` | `admin-layout.css` |
| `.summary-card-hint` | `1.4` | `admin-layout.css` |

**Đề xuất:** Thêm tokens `--admin-line-body: 1.5`, `--admin-line-heading: 1.2`, `--admin-line-tight: 1.15` vào `admin-tokens.css`.

---

## 4. Letter Spacing

### bigbike-web

**Không có `--bb-letter-spacing-*` tokens** — hoàn toàn ad-hoc.

**Inventory đầy đủ các giá trị đang dùng:**

| Value | Dùng ở | Source |
|---|---|---|
| `0em` (tracking-normal) | Buttons, default | Tailwind built-in |
| `0.01em` | `.bb-page h1` | CSS globals.css |
| `0.025em` (tracking-wide) | `PageHero.tsx` h1 | Tailwind built-in |
| `0.04em` | `.bb-query-label`, CompareBar | CSS + Tailwind arbitrary |
| `0.06em` | CompareBar section headers | Tailwind arbitrary |
| `0.08em` | CompareBar column headers, `.detail-field span` | CSS + Tailwind arbitrary |
| `0.1em` (tracking-widest) | `QuickBuyModal` labels | Tailwind built-in |
| `0.1em` | `StatusBadge.tsx` | Tailwind arbitrary |
| `0.12em` | ArticleCard kicker | Tailwind arbitrary |
| `0.14em` | ArticleCard meta | Tailwind arbitrary |
| `0.20em` | `MobileSectionHeader.tsx` kicker | Tailwind arbitrary |
| `0.22em` | `HomeVideoCarousel.tsx` section title | Tailwind arbitrary |
| `-0.01em` | `.topbar-page-title` (admin) | CSS |

**Vấn đề nghiêm trọng:**
- 13 giá trị khác nhau, không có nguyên tắc
- Mix giữa Tailwind built-in (`tracking-wide` = 0.025em), Tailwind arbitrary (`tracking-[0.08em]`), và CSS raw (`letter-spacing: 0.04em`) cho cùng mục đích
- Kicker/eyebrow có 3 giá trị khác nhau: 0.12em, 0.20em, 0.22em — không nhất quán

**Đề xuất tokenize:**
```css
/* brand-tokens.css */
--bb-tracking-tight:    -0.01em;   /* heading dense */
--bb-tracking-normal:    0em;       /* body */
--bb-tracking-wide:      0.04em;   /* label/meta */
--bb-tracking-wider:     0.08em;   /* uppercase label */
--bb-tracking-widest:    0.12em;   /* kicker/eyebrow */
--bb-tracking-display:   0.22em;   /* display uppercase */
```

---

### bigbike-admin

Tương tự — không tokenized. CSS raw trong index.css:
- `letter-spacing: 0.12em` (sidebar brand eyebrow)
- `letter-spacing: 0.1em` (sidebar group labels)
- `letter-spacing: 0.08em` (admin-table headers, detail fields)
- `letter-spacing: 0.05em` (menu table, dash table headers)
- `letter-spacing: 0.04em` (mobile card meta, info-grid)
- `letter-spacing: 0.01em` (sidebar links, topbar page title)
- `letter-spacing: -0.01em` (topbar title, summary card value)

Tailwind trong JSX: `tracking-wide` (GlobalSearch section header, ProductDetailScreen badges).

**Đề xuất tokenize cho admin:**
```css
--admin-tracking-tight:   -0.01em;
--admin-tracking-normal:   0em;
--admin-tracking-label:    0.05em;
--admin-tracking-upper:    0.08em;
--admin-tracking-eyebrow:  0.12em;
```

---

## 5. Text Alignment

### bigbike-web + bigbike-admin

Sử dụng Tailwind utility (`text-left`, `text-center`, `text-right`) một cách contextual — không cần token. Không có vấn đề systemic.

**Một ngoại lệ:** Admin `settings-nav button { text-align: left }` trong CSS raw thay vì Tailwind — nhỏ, không critical.

---

## 6. Text Transform

### bigbike-web

`uppercase` là convention xuyên suốt cho headings, buttons, nav, badges, kickers — **nhất quán và đúng theo docs**. TYPOGRAPHY.md quy định: heading/nav/button/eyebrow → Barlow Condensed + UPPERCASE.

**`normal-case` override:**
- `ProductFaqSection.tsx` AccordionTrigger: `normal-case` ✅ (FAQ là prose, không uppercase)
- `HomeVideoCarousel.tsx` video title: `normal-case` ✅ (title cụ thể, không uppercase)

**CSS globals.css** áp dụng đúng:
- `.bb-page h1`: `text-transform: uppercase`
- `.bb-richtext h1/h2`: `text-transform: uppercase`
- `.bb-header-nav-link`: `text-transform: uppercase`
- `.bb-kicker`: `text-transform: uppercase`

Không có `lowercase` hay `capitalize` không chủ ý.

---

### bigbike-admin

`uppercase` cho: sidebar group labels, table headers, mobile card meta labels, badges. Nhất quán. ✅

---

## 7. Text Decoration

### bigbike-web

**Không có token.** Approach:
- `index.css`: `a { text-decoration: none }` — reset toàn bộ
- `.bb-richtext a`: không explicit, nhưng dùng color brand để distinguish
- Components nav: `no-underline` class (Tailwind `text-decoration: none`)

**Vấn đề nhỏ:**
- `HeaderNavItem.tsx:54,82`: class `no-underline` — redundant vì `a { text-decoration: none }` đã global reset, nhưng không harmful

**Không có hover underline** trên links trong richtext — cần xác nhận với design intent.

---

### bigbike-admin

`a { color: inherit; text-decoration: none }` (index.css:116–119) — clean reset. ✅

---

## 8. Font Style

### bigbike-web

`font-style: italic` chỉ xuất hiện trong:
- `.bb-richtext blockquote` (implied)
- Richtext editor blockquote

Không có `font-style: italic` hardcode trong components — ✅ đúng.

---

### bigbike-admin

- `.tiptap blockquote { font-style: italic }` ✅
- `index.css` không có italic ngoài richtext

---

## 9. Text Overflow / Truncate

### bigbike-web

**Tailwind `truncate` (single-line):**
- `CompareBar.tsx`: product name `truncate text-sm` ✅

**`line-clamp-N` (multi-line):**

| File | Class | Context |
|---|---|---|
| `ComparisonTable.tsx` | `line-clamp-3` | Product names in comparison |
| `MobileCategoryGrid.tsx` | `line-clamp-2` | Category name |
| `ArticleCard.tsx` | `line-clamp-3` | Article title |
| `QuickBuyModal.tsx` | `line-clamp-2` | Product name in modal |
| `RecentlyViewedSection.tsx` | `line-clamp-2` | Product card name |

**Webkit arbitrary (legacy):**
- `HomeVideoCarousel.tsx:90`: `[display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]`

**Vấn đề:**
- `HomeVideoCarousel.tsx` dùng webkit arbitrary thay vì `line-clamp-2` Tailwind — nên migrate sang `line-clamp-2`

---

### bigbike-admin

CSS raw:
- `.topbar-page-title { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }`
- `.menu-item-name { white-space: nowrap; overflow: hidden; text-overflow: ellipsis }`

Tailwind trong JSX:
- `GlobalSearch.jsx`: `truncate text-sm` ✅

**Vấn đề:** CSS classes dùng raw `text-overflow: ellipsis` thay vì `truncate` Tailwind — 3 properties thay vì 1 class.

---

## 10. Word Break / Wrapping

### bigbike-web

Tailwind:
- `PageHero.tsx` h1: `whitespace-nowrap` — hero title không bẻ dòng
- `.bb-header-nav-link`: `white-space: nowrap` (CSS) — nav items không bẻ dòng

**Vấn đề:** `whitespace-nowrap` trên h1 trong PageHero có thể overflow viewport trên mobile 320px — cần kiểm tra.

---

### bigbike-admin

CSS:
- `.mobile-card-meta-value { word-break: break-word }` — đúng cho mobile
- `.admin-table th { white-space: nowrap }` (menu table)

Tailwind trong JSX:
- `ContentDetailScreen.jsx:916`: `break-words` ✅
- `ProductDetailScreen.jsx:2809`: `break-words` ✅

Mix giữa CSS `word-break: break-word` và Tailwind `break-words` — cùng kết quả nhưng inconsistent style.

---

## 11. Paragraph Spacing

### bigbike-web

**Chỉ trong richtext context:**
- `.bb-richtext p`: `margin: 0 0 1em`
- `.tiptap p`: `margin: 0 0 0.75em`

Ngoài richtext, paragraph spacing dùng Tailwind `mb-*` inline — đúng approach. Không cần token riêng.

---

### bigbike-admin

- `.tiptap p { margin: 0 0 0.75em; line-height: 1.65 }` — hardcode
- Approach hợp lý cho admin (ít richtext hơn web).

---

## 12. Text Shadow

### bigbike-web

**Một chỗ duy nhất:**
- `PageHero.tsx` h1: `[text-shadow:0_2px_14px_rgba(0,0,0,0.7)]` — arbitrary Tailwind

Không có token. Nếu dùng trên nhiều hero components, nên tokenize:
```css
--bb-shadow-hero-text: 0 2px 14px rgba(0, 0, 0, 0.7);
```

---

### bigbike-admin

Không dùng text shadow. ✅

---

## 13. Responsive Typography

### bigbike-web

**Triết lý từ docs:** `docs/TYPOGRAPHY.md` quy định rõ — **một token = một `clamp()`, không có per-breakpoint override** cho font size.

**Token layer — đúng:**
- Tất cả `--fs-*` tokens là `clamp()` — ✅
- `--bb-text-h1`, `--bb-text-h2` là `clamp()` — ✅

**🔴 Vi phạm trong components:**

| File | Class vi phạm | Vấn đề |
|---|---|---|
| `PageHero.tsx` h1 | `text-xl sm:text-3xl lg:text-5xl` | 3 breakpoint steps thay vì fluid `text-display` token |
| `HomeVideoCarousel.tsx:90` | `text-[13px] min-[600px]:text-[14px] min-[900px]:text-[15px] min-[1200px]:text-[17px]` | 4 hardcoded px + 3 custom breakpoints |
| `HomeVideoCarousel.tsx:80` | `text-2xl` | Tailwind fixed step, không phải fluid |
| `HomeVideoCarousel.tsx:365` | `text-[15px]` | Hardcoded px |
| `ProductCard.tsx:234` | `text-[18px]` | Hardcoded px — nên là `text-product-title` |
| `ProductCard.tsx:237` | `text-[17px]` | Hardcoded px |
| `MobileSectionHeader.tsx:17` | `text-[10px]` | Hardcoded px |
| `MobileSectionHeader.tsx:21` | `text-2xl` | Tailwind step không fluid |
| `HeaderNavItem.tsx:43,54,82,139` | `text-[13px]`, `text-[12px]` | Hardcoded px |
| `SiteFooter.tsx:260` | `text-[15px] md:text-base` | Breakpoint override + hardcoded px |

**Tổng cộng:** ít nhất 10 component vi phạm quy tắc fluid typography. `HomeVideoCarousel.tsx` là nặng nhất.

**Đề xuất:** Ưu tiên refactor `HomeVideoCarousel.tsx` và `ProductCard.tsx` sang token `text-product-title`, `text-caption`. Xem `docs/TYPOGRAPHY.md` section Migration Rules.

---

### bigbike-admin

Admin không có fluid typography — dùng fixed rem tokens, hợp lý cho operational UI.

**Breakpoints typography trong CSS:**
- `admin-layout.css`: `@media (max-width: 640px) { .info-grid-label { font-size: var(--admin-text-xs) } }`
- `index.css`: `@media (max-width: 480px) { .topbar-page-title { font-size: var(--admin-text-base) } }`

Chỉ 2 breakpoints, mục tiêu rõ ràng. ✅

---

## 14. Semantic Heading Hierarchy h1–h6

### bigbike-web

**h1:**
- `PageHero.tsx` — đúng, h1 cho page title ✅

**h2 — section headers:**
- `MobileSectionHeader.tsx`: section carousels ✅
- `EmptyState.tsx`: empty state title — ⚠️ không phải section, nên là `<p>` hoặc `<strong>`
- `ErrorState.tsx`: error title — ⚠️ idem
- `HeroSlider.tsx`: `<h2>` cho product/category name trong slider — phụ thuộc context page

**h3 — card titles:**
- `card.tsx` CardTitle: `<h3>` ✅
- `ProductCard.tsx`: `<h3>` ✅
- `SiteFooter.tsx` section titles: `<h3>` ✅

**h4–h6:** Chỉ trong richtext CSS, không dùng standalone — ✅

**Vấn đề:**
- `EmptyState.tsx` và `ErrorState.tsx` dùng `<h2>` cho content không phải section heading
- Không có component nào dùng h4/h5/h6 ngoài richtext ✅

---

### bigbike-admin

**h1:**
- `AdminShell.jsx` sidebar: brand name `<h1>` — ⚠️ brand name trong sidebar không phải page title; mọi page đều có `<h1>` này bất kể nội dung

**h4:**
- `DashboardScreen.jsx:107`: `<h4>` cho dashboard section cards

**Vấn đề nghiêm trọng:**
1. **Skip heading level:** Dashboard dùng `<h4>` mà không có `<h2>`, `<h3>` trên cùng page — screen reader nhảy từ h1 → h4
2. **`<h1>` là sidebar brand:** Mọi trang admin đều có `<h1>` là brand name — vi phạm principle "h1 = main content title"
3. **Phần lớn UI admin dùng `<div>` + font-weight** thay vì heading elements — thiếu semantic structure

**Đề xuất:**
- Sidebar brand: đổi từ `<h1>` → `<span>` hoặc `<div aria-label="BigBike Admin">`
- Dashboard section cards: đổi từ `<h4>` → `<h2>`
- Các screen headers: thêm `<h1>` cho page title (hiện đang là styled div)

---

## Tổng hợp các vấn đề theo độ ưu tiên

### 🔴 Cần xử lý trước

1. **Admin font family mismatch** (`CLAUDE.md` vs code): Xác nhận Inter vs Bungee+Exo — cập nhật một trong hai
2. **`--bb-brand` token leak** trong admin (`NewsletterSubscribersScreen.jsx:51`): Đổi sang admin token tương ứng
3. **Web responsive typography violations** — đặc biệt `HomeVideoCarousel.tsx` với 4 breakpoint px hardcode: Migrate sang fluid tokens
4. **Admin h1/h4 heading hierarchy**: Sidebar brand không nên là `<h1>`; dashboard sections nên là `<h2>`

### ⚠️ Cần xử lý sau

5. **`--bb-line-heading: 1.5`** — token value sai so với docs (1.0–1.2 cho headings): Sửa sang `1.1`
6. **`--bb-line-section-kicker/news-title/product-title`** dùng px: Đổi sang unitless ratio
7. **Letter spacing không tokenized** (cả 2 project): Thêm `--bb-tracking-*` và `--admin-tracking-*`
8. **`font-extrabold` (800) không có font được load**: Thay bằng `font-bold` (700) tại `HomeVideoCarousel.tsx:80`
9. **Admin không có `--admin-line-*` tokens**: Thêm để giảm hardcode
10. **`HomeVideoCarousel.tsx` webkit line-clamp**: Đổi sang `line-clamp-2` Tailwind

### Ghi chú nhỏ (refactor opportunity)

11. `HeaderNavItem.tsx` dùng `font-heading` thay vì `font-nav` — same Barlow Condensed nhưng sai intent
12. `EmptyState.tsx`/`ErrorState.tsx` dùng `<h2>` cho non-section content
13. Mix giữa CSS raw `text-overflow: ellipsis` và Tailwind `truncate` trong admin CSS files
14. `Toaster` trong admin `main.jsx` hardcode `fontFamily: 'Inter'` thay vì CSS variable

---

*Audit này chỉ báo cáo và đề xuất — chưa sửa code. Mọi đề xuất cần review với team trước khi implement.*
