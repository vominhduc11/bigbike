# BRAND_GUIDELINES.md

> **Project:** BigBike / bigbike.vn  
> **Brand:** BIG BIKE SHOP  
> **Domain:** `bigbike.vn`  
> **Document role:** Brand identity source of truth for design, content, UI implementation, marketing assets, and AI/code agents.  
> **Last updated:** 2026-04-20

---

## 0. Document Scope

This document defines how BigBike must look, feel, sound, and behave across digital and marketing surfaces.

It is the source of truth for:

- Brand identity
- Logo usage
- Color system
- Typography
- Visual mood
- Photography direction
- Brand-facing UI direction
- Social/POSM direction
- Agent rules for Codex / Claude / ChatGPT / design agents

It is **not** a replacement for:

- `DESIGN_SYSTEM.md`: shared UI components, interaction patterns, responsive rules, design tokens at product scale
- `DESIGN_MAIN.md`: public website, SEO, catalog, PDP, cart, checkout, content-commerce UX
- `DESIGN_ADMIN.md`: admin dashboard and operations UX
- `DESIGN_DEALER.md`: dealer/mobile ordering UX if a dealer system is built later
- `BUSINESS_PROCESS.md`: order, COD, shipping, warranty, return, preorder/backorder flow
- `DATA_CONTRACT.md`: product, variant, customer, cart, order, inventory, warranty schema
- `API_CONTRACT.md`: backend API behavior and integration contract

The usual human mistake is asking one document to run the whole company. This file will not do that. It defines the brand. Other files define product behavior.

---

## 1. Brand Foundation

### 1.1 Brand overview

| Attribute | Standard |
|---|---|
| Brand name | **BIG BIKE SHOP** |
| Public shorthand | **BigBike** |
| Domain | `bigbike.vn` |
| Business type | Retail / D2C commerce for motorcycle safety gear, biker accessories, and touring products |
| Core audience | Biker, touring rider, sport bike rider, motorcycle enthusiast, gear buyer, gift buyer |
| Product groups | Helmet, riding jacket, protective pants, gloves, riding shoes, armor, backpack/bag, Bluetooth intercom, accessories |
| Brand style | Strong, fast, rugged, energetic, modern, practical |
| Visual core | Fullface biker mascot, bold wordmark, dark background, red accent, motorcycle lifestyle |
| Primary emotion | Confidence, speed, protection, freedom, movement |
| Commercial promise | Gear that helps riders ride safer, look stronger, and prepare better for the road |

### 1.2 Brand positioning

BigBike is not a generic ecommerce store. It is a specialist shop for motorcycle riders and touring culture.

The brand must communicate:

- **Protection first:** helmets, armor, gloves, jackets, boots, and safety gear are serious products, not decorative toys.
- **Biker credibility:** product presentation should feel close to real riders, not corporate stock-photo nonsense.
- **Fast decision-making:** users must quickly understand product type, price, size/color options, stock status, warranty, and how to buy.
- **Trust:** BigBike sells products that affect safety and comfort, so the site must feel reliable, not chaotic.
- **Retail practicality:** online browsing, hotline/Zalo/Messenger support, COD, shop confirmation, physical store trust, and content SEO all matter.

### 1.3 Business context constraints

The current BigBike public website behaves like a retail D2C commerce site with:

- Browse/filter/category-led discovery
- Product detail pages with variants, pricing, rating, stock and purchase actions
- Cart/checkout path
- COD and shop confirmation flow
- Manual order support through phone/comment/chat
- Content marketing / SEO pages
- Policy pages for purchase guide, warranty, return, data protection, and terms

Brand implementation must therefore optimize for both:

1. **Conversion:** product discovery, PDP clarity, checkout trust
2. **Trust:** warranty, return, shipping, support, store credibility

Do not design BigBike like a pure lifestyle landing page. It sells products. Users need to buy things. Shocking development, apparently commerce sites should help people purchase.

---

## 2. Brand Personality

BigBike should feel like:

| Trait | Meaning in execution |
|---|---|
| Bold | Strong layout, clear hierarchy, high-contrast visual blocks, confident headlines |
| Energetic | Red accent, dynamic composition, strong CTA, movement cues |
| Rugged | Asphalt, garage, road, touring, leather, metal, helmet, gear texture |
| Modern | Clean UI, disciplined grid, minimal noise, sharp product presentation |
| Professional | Consistent spacing, readable type, clear product information, trustworthy policies |
| Practical | Product details, price, stock, warranty, checkout and support are easy to find |

### 2.1 What BigBike is not

BigBike must not feel like:

- A soft lifestyle fashion brand
- A generic Shopee clone
- A toy-like gamer/neon interface
- A messy sale poster pretending to be a website
- A luxury watch brand with zero usefulness
- A dashboard overloaded with red because someone found the fill bucket

---

## 3. Brand Voice and Copywriting

### 3.1 Voice attributes

| Attribute | Rule |
|---|---|
| Direct | Say the benefit clearly. Avoid vague hype. |
| Confident | Speak like a specialist shop, not a random marketplace seller. |
| Practical | Mention safety, comfort, warranty, fit, use case, and compatibility. |
| Energetic | Use short, active phrases for campaign and CTA. |
| Trustworthy | Avoid exaggerated claims that cannot be verified. |

### 3.2 Copy tone by surface

| Surface | Tone |
|---|---|
| Homepage hero | Strong, short, action-oriented |
| Category page | Helpful, SEO-friendly, practical buying guidance |
| Product card | Compact, factual, price/stock-focused |
| Product detail | Detailed, confidence-building, no fluff |
| Checkout | Clear, calm, trustworthy |
| Policy pages | Precise, plain, legally careful |
| Social media | Punchy, promotional, visual-first |
| Admin UI | Operational, neutral, unambiguous |

### 3.3 Recommended Vietnamese copy style

Use:

```text
Mũ bảo hiểm chính hãng cho biker đường dài
Trang bị bảo hộ cho mỗi chuyến đi
Sẵn sàng cho cung đường tiếp theo
Bảo hộ chắc chắn. Phong cách mạnh mẽ.
Chọn gear đúng, đi đường tự tin hơn
```

Avoid:

```text
Siêu phẩm cực cháy cực chất cực hot
Đỉnh của chóp cho dân chơi hệ tốc độ
An toàn tuyệt đối 100%
Tốt nhất thị trường
```

The last group sounds like a comment section got promoted to brand manager. Do not do that.

### 3.4 English slogan rule

The branding asset contains the slogan:

```text
DON'T LET BEHIND
```

Treat it as a **legacy/source asset**, not as a default public headline.

Before using it in major public UI, campaign, packaging, or signage, confirm whether the intended phrase should be:

```text
DON'T BE LEFT BEHIND
```

Do not silently “correct” logo or slogan artwork. If the slogan is part of an official graphic asset, preserve the asset. If writing new marketing copy, prefer grammatically correct English or Vietnamese copy.

---

## 4. Logo System

### 4.1 Primary logo

The primary logo combines:

- Fullface biker mascot
- Bold **BIG BIKE** wordmark
- Heavy, angular lettering
- Forward motion feeling
- Red, black/dark gray, and white palette

Primary asset paths:

```text
BIG BIKE Branding/LOGO/VECTOR/BIGBIKE_FINAL_LOGO.ai
BIG BIKE Branding/LOGO/PNG/01/
BIG BIKE Branding/LOGO/PNG/02/
```

### 4.2 Logo variants

| Use case | Recommended variant |
|---|---|
| Website header | Full logo or compact wordmark with strong contrast |
| Homepage hero | Full logo only if it does not compete with headline/product |
| Product image watermark | Simplified logo, low opacity, non-intrusive |
| Favicon / app icon | Simplified **B** or compact symbol |
| Social avatar | Mascot or compact logo |
| POSM / signage | Full logo with strong contrast and clear distance visibility |
| Small merchandise | Mascot or wordmark depending on surface ratio |

### 4.3 Clear space

Minimum safe space around the logo:

```text
x = height of the first “B” in BIG
minimum clear space = x on all sides
```

No text, icon, CTA, product image, border, or edge may enter the clear-space area.

### 4.4 Minimum size

| Surface | Minimum guidance |
|---|---|
| Desktop header | Logo height should remain visually readable, usually 40–56px |
| Mobile header | Prefer compact logo, usually 32–44px height |
| Favicon | Use simplified mark only |
| Social avatar | Test at 48x48 and 96x96 |
| Printed POSM | Test visibility from expected viewing distance |

### 4.5 Logo rules

Do:

- Use approved logo assets.
- Preserve original ratio.
- Preserve original angle and geometry.
- Use white/outlined variants on dark or busy backgrounds.
- Keep enough contrast.

Do not:

- Stretch, squash, rotate, skew, or redraw the logo.
- Change the logo to blue, green, purple, orange, gradient, chrome, or other “because it looks cool” inventions.
- Put the logo on a chaotic image without contrast control.
- Place CTA or product badges too close to the logo.
- Use the full logo at sizes where mascot and wordmark become unreadable.

---

## 5. Color System

### 5.1 Core palette

| Token | Name | HEX | RGB | Role |
|---|---|---:|---|---|
| `brand.red` | BigBike Red | `#F90606` | `249, 6, 6` | Primary accent, CTA, sale, price highlight, active state |
| `brand.dark` | BigBike Dark | `#191919` | `25, 25, 25` | Main dark surface, header, footer, brand blocks |
| `brand.black` | Deep Black | `#0A0A0A` | `10, 10, 10` | Deep background, premium contrast |
| `brand.white` | White | `#FFFFFF` | `255, 255, 255` | Text on dark, inverse logo, high-contrast UI |
| `neutral.gray.700` | Dark Gray | `#333333` | `51, 51, 51` | Border, secondary surface, muted structure |
| `neutral.gray.500` | Asset Gray | `#818189` | `129, 129, 137` | Muted text, secondary icon, inactive state |

### 5.2 Supplementary palette

Supplementary colors are allowed for campaign, labels, visual categories, or limited UI states. They are not primary brand colors.

| Token | HEX | Usage |
|---|---:|---|
| `accent.orange` | `#F99D1C` | Promotion, energy, limited campaign accent |
| `accent.magenta` | `#E1058C` | Rare campaign accent, rebellious visual highlight |
| `accent.blue` | `#20C4F4` | Travel/freedom mood, technical or Bluetooth-related accent |
| `accent.green` | `#62BB46` | Outdoor/nature context, success/available state if needed |

### 5.3 UI semantic colors

Do not use brand red for every semantic state. Red is brand accent and danger. That means it needs discipline.

| Semantic token | Suggested HEX | Usage |
|---|---:|---|
| `semantic.success` | `#22C55E` | In stock, completed, success |
| `semantic.warning` | `#F59E0B` | Preorder, low stock, pending confirmation |
| `semantic.danger` | `#F90606` | Error, failed, destructive action, sale emphasis |
| `semantic.info` | `#20C4F4` | Info, Bluetooth/tech cue, neutral notice |
| `semantic.disabled` | `#818189` | Disabled control, unavailable |

### 5.4 Color usage rules

For brand-facing pages:

- Use dark surfaces as the dominant visual base.
- Use red as a sharp accent, not wallpaper.
- Use white and gray for readability.
- Use product photography and red accents to carry energy.

For operational/admin pages:

- Use red sparingly.
- Prioritize readability and data scanning.
- Use semantic colors consistently.
- Do not turn every table into a motorcycle festival poster.

### 5.5 Recommended visual ratio for digital UI

The original branding can use red heavily in static assets. In product UI, reduce red density to preserve hierarchy.

| Color group | Recommended UI ratio |
|---|---:|
| Dark / black / charcoal surfaces | 55–70% |
| White / light text / neutral gray | 20–35% |
| BigBike Red | 5–12% |
| Supplementary accents | 0–5% |

### 5.6 CSS variables

```css
:root {
  /* Brand */
  --bb-color-red: #F90606;
  --bb-color-dark: #191919;
  --bb-color-black: #0A0A0A;
  --bb-color-white: #FFFFFF;

  /* Neutral */
  --bb-color-gray-900: #111111;
  --bb-color-gray-800: #191919;
  --bb-color-gray-700: #333333;
  --bb-color-gray-600: #4B4B4B;
  --bb-color-gray-500: #818189;
  --bb-color-gray-300: #C9C9CF;
  --bb-color-gray-100: #F5F5F5;

  /* Supplementary */
  --bb-color-orange: #F99D1C;
  --bb-color-magenta: #E1058C;
  --bb-color-blue: #20C4F4;
  --bb-color-green: #62BB46;

  /* Surfaces */
  --bb-surface-page: #0A0A0A;
  --bb-surface-header: #0A0A0A;
  --bb-surface-section: #111111;
  --bb-surface-card: #141414;
  --bb-surface-raised: #191919;
  --bb-surface-inverse: #FFFFFF;

  /* Borders */
  --bb-border-subtle: rgba(255, 255, 255, 0.10);
  --bb-border-strong: rgba(255, 255, 255, 0.22);
  --bb-border-red: rgba(249, 6, 6, 0.55);

  /* Text */
  --bb-text-primary: #FFFFFF;
  --bb-text-secondary: rgba(255, 255, 255, 0.76);
  --bb-text-muted: rgba(255, 255, 255, 0.56);
  --bb-text-inverse: #111111;

  /* Action */
  --bb-action-primary: #F90606;
  --bb-action-primary-hover: #D90404;
  --bb-action-primary-pressed: #B80303;
  --bb-action-secondary: transparent;

  /* Semantic */
  --bb-success: #22C55E;
  --bb-warning: #F59E0B;
  --bb-danger: #F90606;
  --bb-info: #20C4F4;
  --bb-disabled: #818189;
}
```

### 5.7 TypeScript color tokens

```ts
export const bigBikeColors = {
  brand: {
    red: '#F90606',
    dark: '#191919',
    black: '#0A0A0A',
    white: '#FFFFFF',
  },
  neutral: {
    gray900: '#111111',
    gray800: '#191919',
    gray700: '#333333',
    gray600: '#4B4B4B',
    gray500: '#818189',
    gray300: '#C9C9CF',
    gray100: '#F5F5F5',
  },
  accent: {
    orange: '#F99D1C',
    magenta: '#E1058C',
    blue: '#20C4F4',
    green: '#62BB46',
  },
  semantic: {
    success: '#22C55E',
    warning: '#F59E0B',
    danger: '#F90606',
    info: '#20C4F4',
    disabled: '#818189',
  },
} as const;
```

### 5.8 Flutter color tokens

```dart
import 'package:flutter/material.dart';

class BigBikeColors {
  const BigBikeColors._();

  static const Color red = Color(0xFFF90606);
  static const Color dark = Color(0xFF191919);
  static const Color black = Color(0xFF0A0A0A);
  static const Color white = Color(0xFFFFFFFF);

  static const Color gray900 = Color(0xFF111111);
  static const Color gray800 = Color(0xFF191919);
  static const Color gray700 = Color(0xFF333333);
  static const Color gray600 = Color(0xFF4B4B4B);
  static const Color gray500 = Color(0xFF818189);
  static const Color gray300 = Color(0xFFC9C9CF);
  static const Color gray100 = Color(0xFFF5F5F5);

  static const Color orange = Color(0xFFF99D1C);
  static const Color magenta = Color(0xFFE1058C);
  static const Color blue = Color(0xFF20C4F4);
  static const Color green = Color(0xFF62BB46);

  static const Color surfacePage = black;
  static const Color surfaceSection = gray900;
  static const Color surfaceCard = Color(0xFF141414);
  static const Color surfaceRaised = dark;

  static const Color textPrimary = white;
  static const Color textSecondary = Color(0xC2FFFFFF);
  static const Color textMuted = Color(0x8FFFFFFF);

  static const Color success = Color(0xFF22C55E);
  static const Color warning = Color(0xFFF59E0B);
  static const Color danger = red;
  static const Color info = blue;
  static const Color disabled = gray500;
}
```

---

## 6. Typography

### 6.1 Typeface system

| Role | Font | Usage |
|---|---|---|
| Display / campaign headline | **Bungee** | Hero, campaign headline, social headline, large promotion title |
| Body / UI / product content | **Exo** | Navigation, body text, forms, product info, table, policy content |
| Web fallback | `Bungee`, `Exo`, `Inter`, `Arial`, `sans-serif` | When custom font is unavailable |
| Mobile fallback | `Bungee`, `Exo`, `Roboto`, `sans-serif` | Flutter / Android |

Typeface asset paths:

```text
BIG BIKE Branding/TYPEFACE/BUNGEE/
BIG BIKE Branding/TYPEFACE/EXO/
```

The asset folders include OFL files. Still, treat fonts as licensed dependencies and manage loading properly. Do not randomly commit font files into public repos without confirming the project policy.

### 6.2 Typography principles

Do:

- Use **Bungee** only for short, high-impact text.
- Use **Exo** for readable UI and long content.
- Test Vietnamese diacritics in all headings and body text.
- Keep product names readable. Product names are not decoration.
- Prefer clear hierarchy over visual shouting.

Do not:

- Use Bungee for paragraph text.
- Use all-caps everywhere.
- Use thin font weights on dark backgrounds.
- Mix unrelated fonts without a clear reason.
- Render important SEO text as images.

### 6.3 Web typography tokens

```css
:root {
  --bb-font-display: "Bungee", "Exo", "Inter", Arial, sans-serif;
  --bb-font-body: "Exo", "Inter", Arial, sans-serif;

  --bb-text-hero: clamp(40px, 6vw, 88px);
  --bb-text-h1: clamp(32px, 4vw, 56px);
  --bb-text-h2: clamp(26px, 3vw, 40px);
  --bb-text-h3: 24px;
  --bb-text-body-lg: 18px;
  --bb-text-body: 16px;
  --bb-text-body-sm: 14px;
  --bb-text-caption: 12px;

  --bb-line-tight: 1.05;
  --bb-line-heading: 1.15;
  --bb-line-body: 1.6;

  --bb-letter-display: 0.01em;
  --bb-letter-body: 0;
}
```

### 6.4 Flutter typography tokens

```dart
import 'package:flutter/material.dart';

class BigBikeTypography {
  const BigBikeTypography._();

  static const String displayFont = 'Bungee';
  static const String bodyFont = 'Exo';

  static const TextStyle hero = TextStyle(
    fontFamily: displayFont,
    fontSize: 48,
    height: 1.05,
    letterSpacing: 0.2,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle h1 = TextStyle(
    fontFamily: displayFont,
    fontSize: 36,
    height: 1.12,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle h2 = TextStyle(
    fontFamily: displayFont,
    fontSize: 28,
    height: 1.15,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle title = TextStyle(
    fontFamily: bodyFont,
    fontSize: 20,
    height: 1.3,
    fontWeight: FontWeight.w700,
  );

  static const TextStyle bodyLarge = TextStyle(
    fontFamily: bodyFont,
    fontSize: 18,
    height: 1.55,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle body = TextStyle(
    fontFamily: bodyFont,
    fontSize: 16,
    height: 1.6,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle bodySmall = TextStyle(
    fontFamily: bodyFont,
    fontSize: 14,
    height: 1.5,
    fontWeight: FontWeight.w400,
  );

  static const TextStyle caption = TextStyle(
    fontFamily: bodyFont,
    fontSize: 12,
    height: 1.4,
    fontWeight: FontWeight.w400,
  );
}
```

---

## 7. Layout, Grid, Spacing

### 7.1 Grid

For public website and marketing layout:

```text
Desktop grid: 12 columns
Content max-width: 1200px–1320px
Outer margin: responsive, never below 16px on mobile
Main content area: usually 10–12 columns depending on section
```

For product listing:

```text
Desktop: sidebar filters + product grid
Tablet: collapsible filter drawer + 2–3 columns
Mobile: search/sort/filter controls + 1–2 columns depending product card density
```

For admin/dashboard:

```text
Prioritize data density, stable alignment, table readability, filter/search toolbar, and sticky action zones.
```

### 7.2 Spacing scale

```css
:root {
  --bb-space-1: 4px;
  --bb-space-2: 8px;
  --bb-space-3: 12px;
  --bb-space-4: 16px;
  --bb-space-5: 20px;
  --bb-space-6: 24px;
  --bb-space-8: 32px;
  --bb-space-10: 40px;
  --bb-space-12: 48px;
  --bb-space-16: 64px;
  --bb-space-20: 80px;
  --bb-space-24: 96px;
}
```

### 7.3 Radius and shape

BigBike should use sharp, technical, sturdy shapes.

| Token | Value | Usage |
|---|---:|---|
| `radius.none` | `0px` | Primary CTA, campaign blocks, strong cards |
| `radius.sm` | `4px` | Inputs, small badges |
| `radius.md` | `8px` | Product cards, content cards |
| `radius.lg` | `12px` | Modal, drawer, large surface |
| `radius.full` | `999px` | Only for pills/tags when functionally useful |

Avoid soft, cute, overly rounded components. This is motorcycle gear, not a marshmallow subscription service.

### 7.4 Layout principles

Do:

- Use strong grid alignment.
- Keep CTA visible and predictable.
- Give product images enough room.
- Separate marketing visual from commerce controls.
- Use whitespace as hierarchy, not as “unused area to panic-fill”.

Do not:

- Overload hero with too many products, stickers, badges, and banners.
- Let background photos fight headline readability.
- Hide important purchase information below decorative content.
- Make filters or search hard to find.

---

## 8. Icon System

### 8.1 Icon style

Brand icon set characteristics:

- Bold filled shapes
- Square/solid visual weight
- Strong contrast
- Suitable for contact info, social, CTA, POSM, UI highlight blocks

Asset paths:

```text
BIG BIKE Branding/ICON/SVG/TRANG/
BIG BIKE Branding/ICON/SVG/DEN/
BIG BIKE Branding/ICON/SVG/DO/
BIG BIKE Branding/ICON/PNG/TRANG/
BIG BIKE Branding/ICON/PNG/DEN/
BIG BIKE Branding/ICON/PNG/DO/
BIG BIKE Branding/ICON/VECTOR/BIGBIKE_ICON.ai
```

### 8.2 Icon color rules

| Variant folder | Meaning | Color |
|---|---|---|
| `TRANG` | White icon | For dark background |
| `DEN` | Black/dark icon | For light background |
| `DO` | Red icon | For emphasis |

### 8.3 UI icon rules

For app/web UI, a modern icon library may be used for functional icons if the original brand icon set does not cover all UI states.

Rules:

- Do not mix filled brand icons with thin outline UI icons in the same visual group.
- Keep stroke/fill weight consistent per component area.
- Use brand icons for brand/contact/highlight modules.
- Use functional UI icons for search, cart, filter, sort, user, close, menu, error, success, and admin actions.
- Red icons are for emphasis only.

---

## 9. Favicon and App Icon

Asset paths:

```text
BIG BIKE Branding/FAVICON/SVG/
BIG BIKE Branding/FAVICON/PNG/
BIG BIKE Branding/FAVICON/VECTOR/BIGBIKE_FAVICON.ai
```

Rules:

- Use the simplest mark at small sizes.
- Prefer compact **B** / symbol variant for favicon.
- Do not use full logo when it becomes unreadable.
- Test on dark browser tabs, light browser tabs, mobile home screen, and PWA install.

Recommended web setup:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<meta name="theme-color" content="#0A0A0A">
```

---

## 10. Photography and Visual Direction

### 10.1 Image mood

BigBike imagery should emphasize:

- Real motorcycle lifestyle
- Fullface helmets
- Protective gear
- Road/touring/garage/asphalt context
- Motion, speed, preparation, confidence
- Product sharpness and material detail
- Dark contrast with red accents

### 10.2 Product photography

Product images must:

- Be sharp and high-resolution.
- Show the product clearly.
- Preserve real color.
- Avoid harsh compression.
- Avoid background clutter.
- Show important angles when relevant: front, side, rear, close-up, size/fit, feature detail.

For helmet/intercom/gear products:

- Show fit and mounting position when possible.
- Include close-up of visor, shell, vent, strap, padding, armor, connector, or control module if relevant.
- Do not crop away important safety/features areas.

### 10.3 Lifestyle imagery

Recommended environments:

- Asphalt road
- Mountain/touring route
- Urban night street
- Garage/workshop
- Biker group ride
- Product-on-rider context
- Helmet close-up with realistic reflections

Avoid:

- Corporate office stock photos
- Overly polished fashion poses with no product relevance
- Random superbike images that distract from product
- AI images with broken helmets, wrong anatomy, impossible gear, fake brand marks, or legally risky logos

### 10.4 Image overlays

When placing text over images:

- Use dark gradient overlay.
- Keep text area visually calm.
- Avoid text on busy helmet/vehicle areas.
- Maintain contrast.
- Keep CTA separate from complex photo details.

---

## 11. Digital Product Guidance

### 11.1 Surface strategy

| Surface | Brand intensity | Rule |
|---|---:|---|
| Homepage | High | Strong visual identity, dark hero, red CTA, lifestyle/product storytelling |
| Category/listing | Medium | Brand mood stays, but discovery and filtering come first |
| Product detail | Medium | Product clarity, trust, warranty, size/color, stock, purchase actions |
| Cart/checkout | Low-medium | Calm, trustworthy, clear next step, no unnecessary visual noise |
| Blog/content | Medium | SEO readable, brand tone, helpful buying education |
| Admin | Low | Functional, readable, operational; brand only as identity layer |
| Dealer/mobile | Medium | Compact, fast ordering, price/stock/quantity clarity |
| Social/POSM | High | Bold campaign expression, strong typography, strong imagery |

### 11.2 Website header

Header should include:

- Logo with strong contrast
- Main navigation
- Search entry point
- Cart entry point
- Account entry point if applicable
- Hotline/Zalo/Messenger access if part of current sales flow
- Mobile menu with clear hierarchy

Recommended style:

- Dark background
- White navigation text
- Red active/hover state
- Sticky or semi-sticky behavior if performance remains good

Do not:

- Hide search on catalog-heavy pages.
- Let promotion banner make header unstable.
- Put too many icons with no labels on desktop.

### 11.3 Homepage hero

Hero should communicate:

- What BigBike sells
- Why riders should trust it
- Primary product/category path
- Main CTA

Recommended composition:

```text
Left: headline + subcopy + primary CTA + secondary CTA
Right: rider/product/gear visual
Background: dark rugged texture, road, garage, or controlled lifestyle photo
```

Primary CTA examples:

```text
Xem sản phẩm
Mua đồ bảo hộ
Khám phá mũ bảo hiểm
Tư vấn qua Zalo
```

Hero must not become a carnival of banners. One main message. One primary action. Humans are already confused enough.

### 11.4 Category / listing page

Category pages must support both SEO and product discovery.

Required elements:

- Category title
- Short category intro
- Product count
- Search field if catalog is medium/large
- Sort control
- Filter control
- Active filter chips
- Product grid/list
- Empty state
- SEO content block below product discovery, not above everything

Product card must show:

- Product image
- Product name
- Price
- Sale price/discount if available
- Stock/preorder/unavailable state
- Variant hint if relevant
- Quick action or view detail CTA

### 11.5 Product detail page

PDP must prioritize:

1. Product image/gallery
2. Product name
3. Price/sale price
4. Variant selection
5. Stock/preorder status
6. CTA: add to cart / buy now / contact
7. Warranty, return, shipping, COD confirmation
8. Specifications
9. Description and SEO content
10. Related products

Trust modules should be visible near purchase area:

```text
Chính hãng / nguồn gốc rõ ràng
Bảo hành theo chính sách sản phẩm
Hỗ trợ đổi trả theo điều kiện
COD / shop gọi xác nhận đơn
Tư vấn qua hotline/Zalo/Messenger
```

### 11.6 Cart and checkout

Checkout tone must be calmer than campaign pages.

Required design priorities:

- Clear item summary
- Quantity controls
- Price breakdown
- Delivery/contact information
- Payment method: COD / bank transfer if supported
- Order confirmation explanation
- Error validation clearly visible
- Support contact available

Do not overload checkout with aggressive sale visuals. At checkout, the customer is trying to finish. Stop waving banners in their face like a desperate street sign.

### 11.7 Search and discovery

For a catalog around hundreds of SKUs, search should be treated as a core UX element.

Search should support:

- Product name
- SKU/model
- Brand
- Category
- Helmet size/color if available
- Intercom/Bluetooth keywords if available

Search UI should include:

- Desktop header search
- Mobile search access
- Recent/popular searches if data exists
- Empty state with category suggestions
- No-result guidance and contact CTA

### 11.8 Admin surface

Admin UI must not copy the full marketing style.

Admin should use:

- BigBike logo in sidebar/header
- Red only for primary action or destructive state
- Neutral/dark readable surfaces
- Tables with strong alignment
- Status badges with semantic colors
- Clear filters, search, bulk actions
- Audit-friendly labels and timestamps

Admin should avoid:

- Bungee in tables/forms
- Heavy background textures
- Large lifestyle images
- Red-heavy dashboards
- Decorative animations

### 11.9 Dealer/mobile surface

If BigBike builds a dealer or mobile ordering app, use brand identity with operational discipline.

Dealer/mobile must prioritize:

- Fast product search
- Clear wholesale/retail price distinction if applicable
- Stock status
- Quantity selector
- Cart summary
- Order status
- Support channel
- Offline/error/loading clarity

Use Bungee only for splash/marketing/title moments. Use Exo/Roboto for most UI.

---

## 12. Components: Brand Rules

### 12.1 CTA buttons

Primary CTA:

```css
.bb-button-primary {
  background: var(--bb-action-primary);
  color: var(--bb-color-white);
  font-family: var(--bb-font-body);
  font-weight: 700;
  border: 1px solid var(--bb-action-primary);
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}

.bb-button-primary:hover {
  background: var(--bb-action-primary-hover);
  border-color: var(--bb-action-primary-hover);
}

.bb-button-primary:active {
  background: var(--bb-action-primary-pressed);
  border-color: var(--bb-action-primary-pressed);
}
```

Secondary CTA:

```css
.bb-button-secondary {
  background: transparent;
  color: var(--bb-color-white);
  border: 1px solid rgba(255, 255, 255, 0.32);
  font-family: var(--bb-font-body);
  font-weight: 700;
  border-radius: 4px;
}

.bb-button-secondary:hover {
  border-color: var(--bb-color-white);
  background: rgba(255, 255, 255, 0.06);
}
```

### 12.2 Product cards

Product cards should use:

- Controlled dark/light surface depending page theme
- Product image area with consistent aspect ratio
- Name with max lines and tooltip/detail path if needed
- Price hierarchy
- Stock/sale/preorder badges
- Quick action if appropriate

Badges:

| Badge | Color logic |
|---|---|
| Sale | BigBike Red |
| In stock | Success green or neutral confirmation |
| Preorder / hàng order | Warning amber |
| Out of stock | Neutral gray |
| New | Blue or red depending campaign |

### 12.3 Forms

Forms should be readable and direct.

Rules:

- Labels visible, not placeholder-only.
- Required fields clearly marked.
- Error text includes message, not only red border.
- Focus state visible.
- Phone/email/address inputs optimized for checkout.
- Password/auth forms must not use vague errors that leak security details.

### 12.4 Empty states

Empty states should help users recover.

Examples:

```text
Không tìm thấy sản phẩm phù hợp.
Thử đổi bộ lọc hoặc tìm theo tên thương hiệu/sản phẩm.
```

```text
Giỏ hàng đang trống.
Khám phá mũ bảo hiểm, găng tay và phụ kiện cho chuyến đi tiếp theo.
```

Do not use cute empty-state illustrations that break the rugged brand mood.

---

## 13. Motion and Interaction

Motion should support speed and clarity, not distract.

Recommended:

- CTA hover: color darken, slight translate/scale
- Product card hover: subtle lift or border highlight
- Section reveal: short fade/translate
- Drawer/menu: fast and stable
- Loading: skeleton, not spinner-only
- Hero: optional very subtle parallax if performance is safe

Avoid:

- Bouncy/cartoon motion
- Excessive parallax
- Slow intro animations
- Auto-playing heavy media that harms Core Web Vitals
- Flashing red elements

Timing:

```css
:root {
  --bb-motion-fast: 120ms;
  --bb-motion-base: 180ms;
  --bb-motion-slow: 280ms;
  --bb-ease-standard: cubic-bezier(0.2, 0, 0, 1);
  --bb-ease-emphasized: cubic-bezier(0.16, 1, 0.3, 1);
}
```

---

## 14. Accessibility and Readability

Minimum requirements:

- Text contrast must be readable on dark surfaces.
- Red text must not be used for long paragraphs.
- Important information must not rely on color only.
- Focus state must be visible.
- Touch targets should be at least 44px on mobile.
- Product price, stock, and CTA must remain readable on all breakpoints.
- Display font must not be used at tiny sizes.

Recommended focus state:

```css
:focus-visible {
  outline: 2px solid #F90606;
  outline-offset: 3px;
}
```

Accessibility is not decoration. It is what prevents users from rage-clicking into the void.

---

## 15. SEO and Content Governance

Because BigBike uses content-commerce, brand rules must support SEO and product discovery.

### 15.1 SEO content rules

- Do not render important category text only as images.
- Use semantic heading structure.
- Product/category copy must be useful, not keyword soup.
- Place long SEO content below primary product discovery when needed.
- Keep product name, price, and availability indexable when technically possible.
- Preserve legacy URLs or use 301 redirects during migration.

### 15.2 Content consistency rules

Must keep consistent:

- Sale percentage and campaign message
- Warranty statement by product/category
- Return policy
- COD/shop confirmation wording
- Footer year/contact information
- Spelling of preorder/backorder labels

Recommended label:

```text
Hàng order
```

Avoid typo:

```text
Hàng oder
```

A typo in a sales label is small, but it whispers “nobody is watching the store”. Not ideal.

---

## 16. Social Media and Campaign Assets

Original social templates follow two main moods:

```text
Bụi bặm
Mạnh mẽ
```

Asset paths:

```text
BIG BIKE Branding/SOCIAL MEDIA/01/
BIG BIKE Branding/SOCIAL MEDIA/02/
```

### 16.1 Social layout rules

Do:

- Use strong headline.
- Use product image clearly.
- Use red for promotion/CTA.
- Keep domain/phone/contact readable.
- Use dark rugged background.
- Keep one primary message per creative.

Do not:

- Add too many discount stickers.
- Use off-brand fonts.
- Hide product behind effects.
- Use supplementary colors as the main brand color.
- Make every design scream at the same volume.

### 16.2 Social copy patterns

```text
SẢN PHẨM MỚI
ƯU ĐÃI CHO BIKER
GEAR CHO CHUYẾN ĐI DÀI
MŨ BẢO HIỂM CHÍNH HÃNG
PHỤ KIỆN TOURING SẴN HÀNG
TƯ VẤN SIZE VÀ MẪU QUA ZALO
```

---

## 17. Signage / POSM

Asset paths:

```text
BIG BIKE Branding/BIENHIEU/PNG REVIEW/
BIG BIKE Branding/BIENHIEU/VECTOR/BIGBIKE_BIENHIEU_TEMPLATE.ai
```

### 17.1 Signage hierarchy

Order of importance:

```text
1. BIG BIKE logo
2. Business category / key offer
3. Domain / hotline
4. Address
5. Secondary service information
```

### 17.2 Signage rules

Do:

- Keep logo visible from distance.
- Use dark background and red accent.
- Use high-contrast text.
- Use grid alignment.
- Avoid placing critical text on busy images.

Do not:

- Stretch logo to fit surface.
- Put contact information larger than brand name.
- Use too many product photos.
- Use non-brand colors for logo.

---

## 18. Asset Inventory

```text
BIG BIKE Branding/
├── BIGBIKE_BRANDGUIDELINE.pdf
├── LOGO/
│   ├── VECTOR/BIGBIKE_FINAL_LOGO.ai
│   └── PNG/
│       ├── 01/   # RGB logo exports
│       └── 02/   # RGBA / transparent logo exports
├── FAVICON/
│   ├── VECTOR/BIGBIKE_FAVICON.ai
│   ├── SVG/
│   └── PNG/
├── ICON/
│   ├── VECTOR/BIGBIKE_ICON.ai
│   ├── SVG/
│   │   ├── TRANG/
│   │   ├── DEN/
│   │   └── DO/
│   └── PNG/
│       ├── TRANG/
│       ├── DEN/
│       └── DO/
├── TYPEFACE/
│   ├── BUNGEE/
│   └── EXO/
├── SOCIAL MEDIA/
│   ├── 01/
│   └── 02/
├── BIENHIEU/
│   ├── PNG REVIEW/
│   └── VECTOR/BIGBIKE_BIENHIEU_TEMPLATE.ai
└── SLOGAN-20200303T044008Z-001/
    └── SLOGAN/
```

### 18.1 Asset governance

Rules:

- Do not rename source assets without mapping.
- Do not commit unnecessary large source files to frontend runtime bundles.
- Optimize PNG/SVG exports for web.
- Keep original AI/PDF/source files in design/archive storage.
- Keep web-ready assets in `public/brand` or equivalent.
- Validate font license and loading strategy before production deployment.

Recommended web asset structure:

```text
public/
└── brand/
    ├── logo/
    │   ├── bigbike-logo-full.svg
    │   ├── bigbike-logo-full.png
    │   └── bigbike-mark.svg
    ├── favicon/
    │   ├── favicon.ico
    │   ├── favicon.svg
    │   └── apple-touch-icon.png
    ├── icons/
    ├── social/
    └── textures/
```

---

## 19. Recommended Project Structure

For Next.js / web:

```text
src/
├── app/
├── components/
│   ├── brand/
│   │   ├── BrandLogo.tsx
│   │   ├── BrandMark.tsx
│   │   └── BrandBadge.tsx
│   ├── commerce/
│   │   ├── ProductCard.tsx
│   │   ├── ProductPrice.tsx
│   │   ├── StockBadge.tsx
│   │   └── TrustBadges.tsx
│   └── ui/
├── lib/
│   └── brand/
│       ├── colors.ts
│       ├── typography.ts
│       ├── spacing.ts
│       └── assets.ts
└── styles/
    ├── brand-tokens.css
    ├── typography.css
    └── globals.css

public/
└── brand/
    ├── logo/
    ├── favicon/
    ├── icons/
    └── social/
```

For Flutter / mobile:

```text
lib/
├── core/
│   └── theme/
│       ├── bigbike_colors.dart
│       ├── bigbike_typography.dart
│       ├── bigbike_spacing.dart
│       ├── bigbike_radius.dart
│       └── bigbike_theme.dart
├── widgets/
│   ├── brand/
│   │   ├── brand_logo.dart
│   │   └── brand_badge.dart
│   └── commerce/
│       ├── product_card.dart
│       ├── stock_badge.dart
│       └── price_text.dart
└── features/

assets/
├── brand/
│   ├── logo/
│   ├── favicon/
│   └── icons/
└── fonts/
```

---

## 20. AI Agent Rules

When Codex, Claude, ChatGPT, or another agent works on BigBike UI, it must follow these rules.

### 20.1 Brand rules

1. Do not change BigBike Red `#F90606`.
2. Do not recolor the logo with supplementary colors.
3. Do not stretch, crop, rotate, or redraw the logo.
4. Do not replace Bungee/Exo unless explicitly required.
5. Do not create bright/default white brand-facing pages unless the surface requires it.
6. Do not overuse red across every UI element.
7. Do not use random gradients, neon effects, or cyberpunk visuals unless defined by a campaign brief.
8. Do not use cute/soft illustration styles for core brand pages.

### 20.2 UI implementation rules

1. Use tokens instead of hardcoded colors.
2. Reuse existing UI components before creating new ones.
3. Product price, CTA, stock, and variant state must be readable on all breakpoints.
4. Search/filter/sort must remain discoverable in catalog pages.
5. Checkout must be calm and clear, not visually aggressive.
6. Admin/dashboard UI must prioritize readability over brand drama.
7. Empty/loading/error states must be handled.
8. Accessibility focus states must exist.
9. Do not hide important SEO/category text inside images.
10. Do not commit font files or large AI/source assets without project approval.

### 20.3 Content rules

1. Do not invent warranty, shipping, return, or COD rules.
2. Do not claim “100% safe”, “best market”, or unverifiable superiority.
3. Keep promotional copy short and direct.
4. Keep product descriptions useful and specific.
5. Avoid typo labels such as `Hàng oder`; use `Hàng order` or an approved Vietnamese alternative.
6. Treat `DON'T LET BEHIND` as a legacy asset unless brand owner confirms public use.

---

## 21. Design Review Checklist

Before merging UI or publishing marketing assets, verify:

### Brand identity

- [ ] Logo uses approved variant.
- [ ] Logo is not stretched or recolored.
- [ ] Logo clear space is respected.
- [ ] Primary color is `#F90606`.
- [ ] Dark colors use `#191919` / `#0A0A0A` family.
- [ ] Supplementary colors do not dominate the brand.

### Typography

- [ ] Display text uses Bungee or approved fallback.
- [ ] Body/UI text uses Exo or approved fallback.
- [ ] Vietnamese diacritics render correctly.
- [ ] Bungee is not used for long paragraphs.
- [ ] Font size and weight are readable on dark surfaces.

### Commerce UX

- [ ] Product image is clear.
- [ ] Product name is readable.
- [ ] Price hierarchy is clear.
- [ ] Stock/preorder/unavailable state is visible.
- [ ] CTA is visible and unambiguous.
- [ ] Warranty/shipping/return/COD trust information is findable.
- [ ] Search/filter/sort are discoverable where needed.

### Layout

- [ ] Grid alignment is consistent.
- [ ] Spacing follows scale.
- [ ] Mobile layout is not just desktop crushed into a tiny rectangle.
- [ ] Header/navigation remains usable.
- [ ] Hero image does not compete with text.

### Accessibility

- [ ] Contrast is readable.
- [ ] Focus state is visible.
- [ ] Form errors have text messages.
- [ ] Important states do not rely on color only.
- [ ] Touch targets are large enough on mobile.

### Content governance

- [ ] Sale percentage is consistent.
- [ ] Warranty claim matches actual policy.
- [ ] Return policy wording is consistent.
- [ ] Footer year/contact/domain are current.
- [ ] No obvious spelling mistakes in labels or campaign text.

### Performance / SEO

- [ ] Hero media is optimized.
- [ ] Images have useful alt text.
- [ ] Important content is crawlable.
- [ ] No unnecessary large brand source assets are bundled.
- [ ] Legacy URLs are preserved or redirected during migration.

---

## 22. Versioning and Maintenance

Recommended version header for future updates:

```text
Version: 1.0.0
Owner: BigBike project/design owner
Last updated: YYYY-MM-DD
Change summary: <short description>
```

Update this document when:

- Logo changes
- Color changes
- Typography changes
- New brand campaign direction is approved
- New sales surface is added, such as dealer app/admin portal
- Product categories expand significantly
- Checkout/payment/support flow changes brand-visible copy

Do not update brand tokens casually. Changing a brand color because it “feels nicer” is how design systems slowly become soup.

---

## 23. Source Notes

This guideline is built from:

- `BIG-BIKE-Branding.zip`
- `BIG BIKE Branding/BIGBIKE_BRANDGUIDELINE.pdf`
- Logo, icon, favicon, typeface, social media, signage and slogan asset folders
- Existing `BRAND_GUIDELINES.md`
- Public website/business analysis of `bigbike.vn`

Key project interpretation:

- BigBike is treated as a retail/D2C motorcycle gear ecommerce brand.
- Public website direction is dark-first, red-accented, rugged, commerce-oriented.
- Admin/dealer surfaces should inherit brand identity but must remain operational and readable.
- This file should be paired with design system and business process documents for production-grade implementation.
