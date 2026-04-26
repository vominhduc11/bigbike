# Bigbike Design System

> **BigBike** — Shop bảo hộ moto / biker gear, TP.HCM, est. 2013
> *"Đồ Bảo Hộ Biker — đồng hành cùng rider Việt Nam"*

Bigbike.vn is a motorcycle safety gear and touring accessory retailer in Ho Chi Minh City. The brand distributes authentic helmets, armored jackets, gloves, boots, intercoms, and touring accessories from international brands: **LS2, Scoyco, Sena, Alpinestars, Furygan, Helite, AGV, Shark, Shoei, Arai**. The visual identity leans into a **rugged, racing-garage** aesthetic: dark-first, sharp-edged, racing red (`#F90606`) as the single accent, heavy uppercase display type, and a mascot/helmeted-rider emblem.

The experience goal: when a rider lands on the site, it should feel like walking into **a premium gear garage** — products arranged with confidence, information legible and rankable, and every interaction nudging toward "you'll be safer if you gear up here."

---

## Sources

- **Codebase** (Next.js 15 app router, Tailwind v4 + CSS tokens): `app/`, `components/`, `lib/`, `styles/brand-tokens.css`
- **Uploads** (logos, slogans, favicons, 48 icon set, brand guideline PDF, fonts): `uploads/`
- **Brand guideline PDF**: `uploads/BIGBIKE_BRANDGUIDELINE.pdf`
- Language: **Vietnamese** (vi). All user-facing copy is Vietnamese; diacritics mandatory.

---

## Index

| File / Folder | What it contains |
|---|---|
| `README.md` | This file — brand context, content + visual foundations, iconography. |
| `SKILL.md` | Agent-skill front matter for Claude Code compatibility. |
| `colors_and_type.css` | All CSS variables + base type/color classes. Drop-in stylesheet. |
| `fonts/` | **Exo** (body, 9 weights) + **Bungee** (display). SIL OFL. |
| `assets/logo/` | Primary mascot logo, wordmarks, 3 slogan lockups ("DON'T LET BEHIND"). |
| `assets/favicon/` | 8 favicon variants (SVG). |
| `assets/icons/` | 48-icon proprietary set (SVG) — categories + utility icons. |
| `assets/signage/` | Physical signage templates — use as hero textures. |
| `assets/social/` | Sample social media compositions — reference for tone. |
| `preview/` | Design system preview cards (rendered in the Design System tab). |
| `ui_kits/website/` | Bigbike.vn website recreation — 3 screens + reusable components. |

---

## Content Fundamentals

**Language.** Vietnamese, with full diacritics. Brand name is written **BigBike** or **BIGBIKE** (all-caps in display contexts, including headers and signage). Never "Big Bike" (two words) in copy.

**Voice.** *Tư vấn kỹ — đáng tin* ("advise carefully — be trustworthy"). A knowledgeable elder-biker friend, not a hype bro. Confident about authenticity (*chính hãng*, *100% chính hãng*, *cam kết*) and about helping pick the right gear (*tư vấn*, *phù hợp*, *đúng đồ*). The English slogan **"DON'T LET BEHIND"** (sic — kept as-is from the brand, it's a Vietlish flex) appears on merch and hero frames.

**Casing.**
- Display / hero / section titles / nav / CTAs → **ALL CAPS** ("SẢN PHẨM NỔI BẬT TẠI BIGBIKE", "MUA NGAY", "XEM CHI TIẾT", "CONTACT NOW").
- Body, article titles → sentence case with correct Vietnamese diacritics.
- Kickers → ALL CAPS, wide letter-spacing (0.12–0.14em).
- Product names render ALL CAPS in cards; brand/category metadata sentence case.

**Person.** Mostly third-person and brand-voice ("Bigbike tự hào là…", "Chúng tôi chuyên cung cấp…"). When addressing the rider, second-person polite: "bạn" (never "quý khách" — too formal, not biker-friendly). Brand self-reference often uses "anh em biker" (fellow bikers) to signal community.

**Emoji.** **Never.** Not on the site, not in UI, not in product copy. Sentiment is communicated through typography, red accent, and iconography.

**Stars.** Product cards use `★★★★★` (black star char) as a visual rating glyph — rendered in Exo; not an SVG icon.

**Vietnamese + Latin mixing.** Brand phrases ("SALE", "HOT OFFER", "CONTACT NOW") sit in Latin; descriptions stay Vietnamese. Prices formatted via `formatVnd()` — Vietnamese convention: `2.590.000 ₫` (period thousand separator, trailing ₫).

**Example copy (all real, pulled from `app/page.tsx`):**
- Hero kicker: `SẢN PHẨM NỔI BẬT`
- Hero title: `SẢN PHẨM NỔI BẬT TẠI BIGBIKE`
- About block: `Bigbike tự hào là một trong những shop chuyên bán đồ phượt, đồ bảo hộ moto đáng tin cậy tại TP HCM…`
- CTA: `Mua ngay`, `Thêm vào giỏ hàng`, `Xem tất cả →`
- Promo: `HOT OFFER · LS2 DUAL SPORT MX436 PIONEER · 20% OFF`
- Stock labels: `Còn hàng`, `Sắp hết hàng`, `Hết hàng`, `Đặt trước`, `Liên hệ tồn kho`

---

## Visual Foundations

### Palette
- **Single brand accent: racing red `#F90606`** — used for CTAs, prices, stock-danger, kickers, nav hover. Never diluted with other "brand" hues.
- **Dark-first surfaces:** `#0a0a0a` (page), `#141414` (surface), `#202020` (raised), `#292929` (hover). The whole site runs on `bb-theme-dark`.
- **Light override (`wp-home`):** the public homepage flips to white (`#fff`) with `#111` text, reusing the red accent. This is intentional — dark shell + light editorial body, mimicking the production site.
- **State hues are muted and never compete with red:** warning orange `#f99d1c`, info cyan `#20c4f4`, success green `#62bb46`. They appear only in stock/payment badges.

### Typography
- **Display: Bungee Regular** — one weight, all caps, for section titles, logo wordmark, promo burners.
- **Body: Exo (Exo 2 family)** — full 300–900 ramp. UI defaults to 400/600/700. 900 italic is reserved for big editorial display titles in the light WP theme (where Bungee sometimes steps aside).
- **Uppercase is the default** for kickers, nav, buttons, product card titles, badges, CTAs, and even many H2s. Sentence case is the exception — reserved for long-form paragraphs and article bodies.
- **Letter-spacing.** Display uses `0.01em` (slight open for legibility on Bungee). UI kickers and buttons use `0.04–0.14em`. Body is `0`.
- **Line-heights.** Display `1.08` (tight). Headings `1.16`. Body `1.6`. UI `1.4`.

### Backgrounds
- **Page is black**, not a gradient. Surfaces are flat dark greys (`#141414`, `#202020`).
- **Heroes use radial-gradient halos**: red at one corner, white soft at another, over a 145° linear charcoal gradient. Signature pattern — do not swap for plain solid.
  ```css
  background:
    radial-gradient(circle at 88% 22%, rgba(249,6,6,0.22), transparent 28%),
    radial-gradient(circle at 20%  0%, rgba(255,255,255,0.12), transparent 42%),
    linear-gradient(145deg, #0d0d0d 0%, #171717 48%, #1f1f1f 100%);
  ```
- **Hero overlay** for image-backed slides: a 90° gradient `rgba(10,10,10,0.96) → 0.32`, so text stays readable on the left while photography breathes on the right.
- **Promo banners** use a crimson linear gradient `#c00 → #8b0000` with a huge low-opacity "BIGBIKE" watermark — referenced as `.wp-promo-banner`.
- No illustrations, no hand-drawn, no checker-patterns. Textures come from product photography on a dark-grey radial card.

### Iconography — approach
See dedicated **ICONOGRAPHY** section below.

### Animation
- Durations: `80ms` instant, `140ms` fast (hovers), `220ms` normal, `360ms` slow.
- Easings: standard `cubic-bezier(0.2,0,0,1)`, emphasized `(0.2,0,0,1.2)`, exit `(0.4,0,1,1)`.
- **Hover on cards**: border fades from subtle → red, card lifts `translateY(-2px)`, shadow deepens. Never scale up — bikes don't "bounce".
- **Hover on product cards**: a `THÊM VÀO GIỎ HÀNG` black bar slides up from the bottom over the image.
- **Primary button hover**: `translateY(-1px)`, background goes from `#f90606` → `#d90404`.
- **Focus ring**: always red, `0 0 0 3px rgba(249,6,6,0.36)`.
- **Carousels**: `scroll-smooth`, snap-start. Hero slider auto-advances every 5s.
- `prefers-reduced-motion` is honored (transitions knocked to 1ms).

### Hover / Press states
- **Text links**: red underline (or red text color for nav links). Nav link hover also adds `background: var(--bb-brand-primary-soft)` + red border.
- **Buttons**: lift + darker red on hover; settle + darkest red on active.
- **Cards**: border fades red, lift, shadow deepens.
- **Icon buttons (header)**: text color flips to red + subtle white overlay background.
- **Disabled**: `opacity: 0.48`, `cursor: not-allowed`, no transform.

### Borders
- **1px subtle** (`rgba(255,255,255,0.10)`) — default card borders on dark surfaces.
- **1px default** (`rgba(255,255,255,0.16)`) — inputs, dividers.
- **1px strong** (`rgba(255,255,255,0.28)`) — secondary buttons.
- **1px brand** (red @ 36% alpha) — hover/active states.
- **Light WP surfaces**: `#e8e8e8` for card grids, `#ddd` for dividers, sharp 1px, no pillow-soft edges.

### Shadows
- `sm: 0 2px 8px rgba(0,0,0,0.24)` — card rest.
- `md: 0 8px 24px rgba(0,0,0,0.32)` — card hover.
- `lg: 0 18px 48px rgba(0,0,0,0.42)` — modal, drawer.
- `brand: 0 12px 30px rgba(249,6,6,0.22)` — primary buttons, hero CTAs.

### Corner radii
- Sharp-leaning. Defaults: `button = sm (4px)`, `input = sm (4px)`, `card = md (8px)`, `brand marks = sm`.
- Pills (`999px`) only for variant chips and some badges.
- **Never** use `xl` (16px) on primary UI — it reads too consumer-soft.

### Layout & spacing
- 4px spacing scale (`bb-space-1 .. bb-space-32`).
- Container max width `1440px` (`--bb-container-xl`). Page padding: 16/24/32px mobile/tablet/desktop.
- Sticky header, 72px tall, with a **trapezoidal black logo panel** that's clip-pathed on the right (`clip-path: polygon(0 0, 100% 0, calc(100% - 28px) 100%, 0 100%)`). Unique brand detail — do not drop.
- Red bullet separators (`•` in brand red) divide nav items.
- Footer grid: 4 columns desktop → 2 tablet → 1 mobile.

### Transparency / blur
- Header: `background: color-mix(in srgb, var(--bb-bg-page) 90%, transparent); backdrop-filter: blur(8px);` — the only place `backdrop-filter` is used.
- Hero overlays use straight `rgba()` — no blur.

### Imagery
- Photography is **cool-to-neutral, high-contrast**, shot on or styled for dark grey. Products photographed on plain backgrounds and placed in a radial-highlight wrapper for depth.
- Article/experience images are **crimson-tinted** via `filter: saturate(1.4) brightness(0.72)` + a red `rgba(160,0,0,0.35)` overlay. This creates the recognizable "Bigbike red wash" on editorial blocks.
- No grain, no vignettes, no halftones — keep photography clean.
- 4:3 for experience blocks, 16:9 for article cards, 1:1 for product tiles, 16:5.5 for hero slider.

### Fixed elements
- Floating chat bubble bottom-right, `#20c4f4` (only non-red accent allowed at this level), 52px round, with a small white "Chat với BigBike" label tooltip. Zalo link or `tel:` hotline.
- Header is sticky with blur. Promo "cart badge" sits top-right of cart icon.

---

## ICONOGRAPHY

Bigbike ships with a **proprietary 48-icon set** delivered in `BIGBIKE_ICON-01.svg` through `BIGBIKE_ICON-48.svg` (copied into `assets/icons/`). Matching PNGs exist in `uploads/` for raster fallbacks. These cover product-category icons (helmet, jacket, gloves, boots, bag, intercom, rain gear, knee pad, etc.) plus UI utility icons (hamburger, cart, search, user, map pin, phone, zalo, facebook, youtube, shipping truck, shield, checkmark).

**Style.** Bold solid-fill silhouettes on a **red rounded-square tile** (~256px native, `border-radius: 32–40px`). White glyph on red, punchy contrast. The fill style matches the aggressive, mascot-era logo language — **no outline/stroke variants exist**.

**Usage.**
- On dark surfaces, the red tile gives icons their own heat. On light surfaces, they sit clean against white.
- Use them at their native aspect (1:1) and do not recolor — the red tile **is** the brand signal.
- When a UI slot expects a mono icon (header cart, arrow chevrons, search), inline a **Lucide-style 2px stroke SVG in `currentColor`** — that's the codebase convention (`SiteHeader.tsx` uses this pattern).

**Icon systems in play, documented:**
1. **Bigbike Proprietary 48-set** — `assets/icons/bigbike-icon-XX.svg` — for category cards, feature blocks, signage, social media.
2. **Inline Lucide-style strokes** — hand-written in components for UI chrome (search, cart, user, hamburger, arrow). 20×20 or 24×24, `stroke-width="2"`, `stroke="currentColor"`, `stroke-linecap="round"`.
3. **Unicode stars** `★★★★★` (U+2605) — product rating. No SVG.
4. **Emoji** — never used.
5. **No icon fonts** (no Lucide import, no Font Awesome). Everything is SVG.

**When adding new icons.** First check if the 48-set has a match. If not, draw a new Lucide-style 2px-stroke inline SVG using `currentColor`. Do **not** invent a new flat-red-tile icon — the 48-set is closed.

---

## Logo & Lockups

- **Primary mark:** `assets/logo/bigbike-logo-primary.png` — helmeted biker mascot with crossed arms under a bannered "BIG·BIKE" wordmark. Red/black/white. Use on dark backgrounds.
- **Mono white mark:** `assets/logo/bigbike-logo-mono-white.png` — same shape, no red. Use when the surface already carries red.
- **Wordmark only:** `assets/logo/bigbike-logo-wordmark*.png` — banner without mascot. Use in tight horizontal slots (header, footer).
- **Slogan lockup:** `assets/logo/bigbike-slogan-dont-let-behind.png` — "DON'T LET BEHIND" banner, tournament-style. Use sparingly on hero frames and signage.
- **Favicons:** `assets/favicon/favicon-01.svg` through `-08.svg` — 8 glyph variants (H-block, BB monogram, helmet silhouette, hamburger tile, etc.). `favicon-01.svg` is the red H-block default.

**Clear-space rule.** Keep min 0.5× the mascot's helmet height around the logo. Never place on clashing imagery; if no dark backdrop exists, use a black panel with the trapezoidal clip-path (see header).

---

## What's in `ui_kits/website/`

Three click-through screens that reassemble the real Bigbike.vn:
1. **Homepage (`index.html`)** — dark header + WP-light body: hero slider → 3 featured tiles → about block → product carousel → category grid → red promo banner → experience images → news cards → brand carousel → SEO footer.
2. **Product listing (catalog).**
3. **Product detail (with variant chips + purchase panel).**

All components are cosmetic React (JSX) — no real API. Interactions (add to cart toast, hover product bar, slider advance) are wired so the flow feels real.

---

## Known caveats / substitutions

- **Bungee** and **Exo** were supplied as TTFs — shipped inline via `@font-face`, no Google Fonts fallback needed.
- The brand guideline PDF exists at `uploads/BIGBIKE_BRANDGUIDELINE.pdf` — not parsed programmatically into this doc; tokens instead pulled from `styles/brand-tokens.css` which is the production source of truth.
- The production site is Vietnamese throughout; this system preserves that. English only appears in slogans and utility labels ("SALE", "HOT OFFER").
