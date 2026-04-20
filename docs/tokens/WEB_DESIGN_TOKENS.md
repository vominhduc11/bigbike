# WEB_DESIGN_TOKENS.md

> Implementation token guideline cho `bigbike-web`.
>
> File này định nghĩa token-level rules cho public website BigBike: brand colors, semantic colors, typography, spacing, layout, product card, category, PDP, cart, checkout, content/SEO, motion, accessibility và responsive token mapping.
>
> File này phải bám theo:
> - `docs/brand/BRAND_GUIDELINES.md`
> - `docs/design/DESIGN_SYSTEM.md`
> - `docs/design/WEB_DESIGN.md`
>
> File này không định nghĩa backend API, database schema, business rules, admin dashboard tokens hoặc page content cụ thể. Token không phải nơi để chôn toàn bộ vũ trụ vì team chưa biết để ở đâu.

---

## 1. Purpose

`WEB_DESIGN_TOKENS.md` là tài liệu chuẩn hóa token cho `bigbike-web`, website public phục vụ SEO, product discovery và bán hàng cho khách hàng cuối.

Mục tiêu:

- Chuẩn hóa màu, typography, spacing, radius, shadow, motion cho website.
- Giữ BigBike brand nhất quán: đỏ/đen, bold, sporty, mechanical, biker-focused.
- Hỗ trợ SEO-friendly UI, product listing, PDP, cart, checkout và content pages.
- Tránh hardcode style rải rác trong components.
- Giúp AI agent và developer biết dùng token nào trong từng context.
- Tách rõ web token với admin token.

File này chịu trách nhiệm cho:

- Token naming convention.
- Web color tokens.
- Product/commerce semantic tokens.
- Typography tokens.
- Spacing/layout tokens.
- Web component tokens.
- Hero/category/PDP/cart/checkout/content token guidance.
- Responsive token rules.
- CSS/TypeScript/Tailwind mapping examples.

File này không chịu trách nhiệm cho:

- Admin dashboard UI density.
- Admin table/form tokens.
- Business rules.
- API contract.
- Database schema.
- Logo/asset inventory chi tiết.
- Page copy cụ thể.

---

## 2. Token Philosophy

### 2.1 Use semantic tokens first

Component không nên dùng raw value trực tiếp.

Ưu tiên:

```text
web.color.action.primary.background
web.color.product.price
web.color.surface.card
web.spacing.section.lg
web.productCard.image.aspectRatio
web.hero.title.fontSize
```

Không ưu tiên:

```text
red
black
white
marginBig
cardColor
#F90606
```

Primitive tokens chỉ là nền. Component phải dùng semantic tokens.

### 2.2 Web tokens are commerce-first

`bigbike-web` khác `bigbike-admin`.

Web cần:

- Brand expression mạnh hơn.
- Product image nổi bật.
- CTA rõ.
- Price/sale/stock state rõ.
- SEO/content readability.
- Mobile-first conversion.
- Visual hierarchy cho khách hàng cuối.

Không copy admin token sang web nếu làm web quá nhạt, quá dense hoặc giống dashboard.

### 2.3 Token hierarchy

Token hierarchy:

```text
Primitive tokens
  -> Semantic tokens
    -> Component tokens
      -> State/variant tokens
```

Ví dụ:

```text
brand.red.500
  -> web.color.action.primary.background
    -> web.button.primary.background.default
      -> web.button.primary.background.hover
```

### 2.4 No one-off tokens without reason

Chỉ tạo token mới khi:

- Có semantic rõ.
- Có pattern tái sử dụng.
- Được document.
- Không trùng token hiện có.

Không tạo token kiểu:

```text
homepageSpecialRed
productCardButOnlyForThisOneSection
temporaryGradient2
```

Đó không phải design system, đó là hầm trú ẩn của technical debt.

---

## 3. Token Naming Convention

### 3.1 Prefix

Tất cả web tokens nên dùng prefix:

```text
web.
```

Ví dụ:

```text
web.color.text.primary
web.spacing.section.md
web.hero.background.overlay
web.productCard.price.color
web.checkout.summary.stickyOffset
```

Nếu map sang CSS variables:

```css
--web-color-text-primary
--web-spacing-section-md
--web-hero-background-overlay
--web-product-card-price-color
```

### 3.2 Naming structure

Format khuyến nghị:

```text
web.{category}.{role}.{property}.{state}
```

Ví dụ:

```text
web.color.action.primary.background.default
web.color.action.primary.background.hover
web.productCard.background.default
web.productCard.background.hover
web.hero.title.fontSize
web.checkout.summary.background
```

### 3.3 Category names

Category chính:

```text
web.color
web.typography
web.spacing
web.layout
web.radius
web.border
web.shadow
web.motion
web.zIndex
web.button
web.input
web.card
web.productCard
web.categoryCard
web.hero
web.header
web.footer
web.badge
web.breadcrumb
web.search
web.filter
web.pdp
web.cart
web.checkout
web.content
web.toast
web.modal
web.skeleton
```

### 3.4 State names

State chuẩn:

```text
default
hover
active
focus
selected
disabled
loading
error
success
warning
info
sale
new
featured
outOfStock
preorder
```

Không dùng state name mơ hồ như:

```text
cool
hotStyle
special
temporary
darkish
```

---

## 4. Brand Primitive Tokens

Brand primitive tokens lấy từ `BRAND_GUIDELINES.md`.

### 4.1 Core brand primitives

| Token | Value | Usage |
|---|---:|---|
| `brand.red.500` | `#F90606` | BigBike primary red |
| `brand.dark.900` | `#191919` | Dark gray / brand dark |
| `brand.black` | `#0A0A0A` | Deep black |
| `brand.white` | `#FFFFFF` | White |
| `brand.gray.500` | `#818189` | Asset gray |
| `brand.gray.700` | `#333333` | Support gray |
| `brand.orange.500` | `#F99D1C` | Supporting orange |
| `brand.pink.500` | `#E1058C` | Supporting pink |
| `brand.blue.500` | `#20C4F4` | Supporting blue |
| `brand.green.500` | `#62BB46` | Supporting green |

### 4.2 Web usage rule

Primitive tokens không nên dùng trực tiếp trong component.

Tốt:

```text
web.color.product.price = brand.red.500
```

Không tốt:

```tsx
<span style={{ color: '#F90606' }}>1.200.000đ</span>
```

Raw value rải rác là cách biến redesign thành một trò săn kho báu trong đống CSS.

---

## 5. Web Color Tokens

### 5.1 Web color strategy

Web color strategy:

- Dark-first cho brand-heavy surfaces.
- Red là primary CTA, price, sale, active và campaign accent.
- White/near-white surfaces có thể dùng cho content readability nếu cần.
- Product image phải nổi bật trên surface.
- Supporting colors dùng tiết chế cho campaign/status.
- Text contrast phải đủ tốt trên cả dark và light sections.

### 5.2 Background tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `web.color.background.page` | `#0A0A0A` | Default brand page background |
| `web.color.background.section.dark` | `#191919` | Dark section |
| `web.color.background.section.black` | `#0A0A0A` | Deep black section |
| `web.color.background.section.light` | `#F7F7F8` | Light content/SEO section |
| `web.color.background.body` | `#FFFFFF` | Long-form readable content if needed |
| `web.color.background.overlay.dark` | `rgba(10,10,10,0.72)` | Hero/media overlay |
| `web.color.background.overlay.soft` | `rgba(10,10,10,0.48)` | Soft overlay |

### 5.3 Surface tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `web.color.surface.card.dark` | `#141414` | Dark product/card surface |
| `web.color.surface.card.darkHover` | `#202020` | Product card hover |
| `web.color.surface.card.light` | `#FFFFFF` | Light cards/content |
| `web.color.surface.subtleDark` | `#191919` | Secondary dark panel |
| `web.color.surface.subtleLight` | `#F3F4F6` | Secondary light panel |
| `web.color.surface.inputDark` | `#141414` | Dark input/search |
| `web.color.surface.inputLight` | `#FFFFFF` | Light form input |
| `web.color.surface.selected` | `rgba(249,6,6,0.12)` | Selected/active surface |

### 5.4 Text tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `web.color.text.primaryDark` | `rgba(255,255,255,0.96)` | Main text on dark |
| `web.color.text.secondaryDark` | `rgba(255,255,255,0.74)` | Secondary on dark |
| `web.color.text.mutedDark` | `rgba(255,255,255,0.56)` | Muted on dark |
| `web.color.text.disabledDark` | `rgba(255,255,255,0.36)` | Disabled on dark |
| `web.color.text.primaryLight` | `#151515` | Main text on light |
| `web.color.text.secondaryLight` | `#4B5563` | Secondary on light |
| `web.color.text.mutedLight` | `#6B7280` | Muted on light |
| `web.color.text.inverse` | `#FFFFFF` | Text on red/dark |
| `web.color.text.brand` | `#F90606` | Brand emphasis |
| `web.color.text.price` | `#F90606` | Price text |

### 5.5 Border tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `web.color.border.darkSubtle` | `rgba(255,255,255,0.10)` | Dark surface border |
| `web.color.border.darkDefault` | `rgba(255,255,255,0.16)` | Default dark border |
| `web.color.border.darkStrong` | `rgba(255,255,255,0.28)` | Strong dark border |
| `web.color.border.lightSubtle` | `#E5E7EB` | Light surface border |
| `web.color.border.lightDefault` | `#D1D5DB` | Light default border |
| `web.color.border.focus` | `#F90606` | Focus border |
| `web.color.border.brand` | `rgba(249,6,6,0.44)` | Brand border |
| `web.color.border.error` | `#D90404` | Error border |

### 5.6 Action tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `web.color.action.primary.background.default` | `#F90606` | Primary CTA |
| `web.color.action.primary.background.hover` | `#D90404` | CTA hover |
| `web.color.action.primary.background.active` | `#B80303` | CTA active |
| `web.color.action.primary.text` | `#FFFFFF` | CTA text |
| `web.color.action.secondary.background.dark` | `transparent` | Dark secondary button |
| `web.color.action.secondary.text.dark` | `#FFFFFF` | Dark secondary text |
| `web.color.action.secondary.border.dark` | `rgba(255,255,255,0.32)` | Dark secondary border |
| `web.color.action.secondary.background.light` | `#FFFFFF` | Light secondary button |
| `web.color.action.secondary.text.light` | `#151515` | Light secondary text |
| `web.color.action.secondary.border.light` | `#D1D5DB` | Light secondary border |
| `web.color.action.tertiary.text` | `#F90606` | Text link / tertiary action |

### 5.7 Product/commerce tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `web.color.product.price` | `#F90606` | Product price |
| `web.color.product.comparePrice` | `rgba(255,255,255,0.50)` | Compare price on dark |
| `web.color.product.comparePriceLight` | `#6B7280` | Compare price on light |
| `web.color.product.sale.background` | `#F90606` | Sale badge |
| `web.color.product.sale.text` | `#FFFFFF` | Sale badge text |
| `web.color.product.stock.in` | `#62BB46` | In stock |
| `web.color.product.stock.low` | `#F99D1C` | Low stock |
| `web.color.product.stock.out` | `#818189` | Out of stock |
| `web.color.product.stock.preorder` | `#20C4F4` | Preorder/backorder |
| `web.color.product.rating` | `#F99D1C` | Rating stars |

---

## 6. Status Color Tokens

Status phải dùng text + color, không dùng màu một mình.

| Semantic | Background | Text | Border | Web usage |
|---|---:|---:|---:|---|
| Success | `rgba(98,187,70,0.14)` | `#62BB46` | `rgba(98,187,70,0.34)` | In stock, success |
| Warning | `rgba(249,157,28,0.14)` | `#F99D1C` | `rgba(249,157,28,0.34)` | Low stock, caution |
| Error | `rgba(249,6,6,0.14)` | `#F90606` | `rgba(249,6,6,0.38)` | Error, unavailable |
| Info | `rgba(32,196,244,0.14)` | `#20C4F4` | `rgba(32,196,244,0.34)` | Info, preorder |
| Neutral | `rgba(129,129,137,0.14)` | `#818189` | `rgba(129,129,137,0.34)` | Disabled, archived |
| Campaign | `rgba(225,5,140,0.14)` | `#E1058C` | `rgba(225,5,140,0.34)` | Campaign/promo accent |

Token names:

```text
web.color.status.success.background
web.color.status.success.text
web.color.status.success.border
...
web.color.status.campaign.background
web.color.status.campaign.text
web.color.status.campaign.border
```

---

## 7. Typography Tokens

### 7.1 Font family tokens

| Token | Value | Usage |
|---|---|---|
| `web.typography.font.display` | `Bungee, Exo, Inter, Arial, sans-serif` | Hero/campaign/display |
| `web.typography.font.body` | `Exo, Inter, Arial, sans-serif` | Body/product/UI |
| `web.typography.font.ui` | `Exo, Inter, Arial, sans-serif` | Navigation/forms/buttons |
| `web.typography.font.mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | SKU/code if needed |

### 7.2 Font size scale

| Token | Suggested value | Usage |
|---|---:|---|
| `web.typography.size.xs` | `12px` | Caption/metadata |
| `web.typography.size.sm` | `14px` | Small UI/product metadata |
| `web.typography.size.md` | `16px` | Body/input |
| `web.typography.size.lg` | `18px` | Large body |
| `web.typography.size.xl` | `20px` | Small heading/product title |
| `web.typography.size.2xl` | `24px` | Section heading mobile |
| `web.typography.size.3xl` | `30px` | Section heading |
| `web.typography.size.4xl` | `36px` | Page heading |
| `web.typography.size.5xl` | `48px` | Hero heading |
| `web.typography.size.6xl` | `60px` | Large desktop hero |
| `web.typography.size.7xl` | `72px` | Campaign display |
| `web.typography.size.hero` | `clamp(40px, 6vw, 88px)` | Hero |
| `web.typography.size.h1` | `clamp(32px, 4vw, 56px)` | H1 |
| `web.typography.size.h2` | `clamp(26px, 3vw, 40px)` | H2 |

### 7.3 Font weight

| Token | Suggested value |
|---|---:|
| `web.typography.weight.regular` | `400` |
| `web.typography.weight.medium` | `500` |
| `web.typography.weight.semibold` | `600` |
| `web.typography.weight.bold` | `700` |
| `web.typography.weight.black` | `900` |

### 7.4 Line height

| Token | Suggested value | Usage |
|---|---:|---|
| `web.typography.lineHeight.none` | `1` | Display |
| `web.typography.lineHeight.tight` | `1.08` | Hero/campaign heading |
| `web.typography.lineHeight.heading` | `1.16` | Section headings |
| `web.typography.lineHeight.ui` | `1.4` | UI labels/buttons |
| `web.typography.lineHeight.body` | `1.65` | Long text/content |
| `web.typography.lineHeight.product` | `1.45` | Product names/descriptions |

### 7.5 Letter spacing

| Token | Suggested value |
|---|---:|
| `web.typography.letterSpacing.tight` | `-0.02em` |
| `web.typography.letterSpacing.normal` | `0` |
| `web.typography.letterSpacing.display` | `0.01em` |
| `web.typography.letterSpacing.button` | `0.04em` |

### 7.6 Typography roles

| Role | Font | Size | Weight | Line height |
|---|---|---:|---:|---:|
| `heroTitle` | Bungee | clamp 40-88px | 400 | 1.08 |
| `pageTitle` | Bungee/Exo | clamp 32-56px | 400/700 | 1.16 |
| `sectionTitle` | Bungee/Exo | clamp 26-40px | 400/700 | 1.16 |
| `productNameCard` | Exo | 15-16px | 600 | 1.45 |
| `productNamePdp` | Exo | 28-40px | 700 | 1.2 |
| `priceCard` | Exo | 18px | 700 | 1.2 |
| `pricePdp` | Exo | 28-36px | 700 | 1.15 |
| `body` | Exo | 16px | 400 | 1.65 |
| `articleBody` | Exo | 17-18px | 400 | 1.75 |
| `caption` | Exo | 12px | 400 | 1.4 |
| `button` | Exo | 14px | 700 | 1.2 |

---

## 8. Spacing Tokens

### 8.1 Base spacing scale

Web spacing bám theo 4px scale.

| Token | Value |
|---|---:|
| `web.spacing.0` | `0` |
| `web.spacing.1` | `4px` |
| `web.spacing.2` | `8px` |
| `web.spacing.3` | `12px` |
| `web.spacing.4` | `16px` |
| `web.spacing.5` | `20px` |
| `web.spacing.6` | `24px` |
| `web.spacing.8` | `32px` |
| `web.spacing.10` | `40px` |
| `web.spacing.12` | `48px` |
| `web.spacing.16` | `64px` |
| `web.spacing.20` | `80px` |
| `web.spacing.24` | `96px` |
| `web.spacing.32` | `128px` |

### 8.2 Section spacing

| Token | Suggested value | Usage |
|---|---:|---|
| `web.spacing.section.xs` | `32px` | Small internal sections |
| `web.spacing.section.sm` | `48px` | Compact section |
| `web.spacing.section.md` | `64px` | Default mobile/tablet |
| `web.spacing.section.lg` | `96px` | Desktop section |
| `web.spacing.section.xl` | `128px` | Hero/major section |

### 8.3 Page padding

| Token | Suggested value |
|---|---:|
| `web.spacing.page.paddingX.mobile` | `16px` |
| `web.spacing.page.paddingX.tablet` | `24px` |
| `web.spacing.page.paddingX.desktop` | `32px` |
| `web.spacing.page.paddingY.mobile` | `32px` |
| `web.spacing.page.paddingY.desktop` | `64px` |

### 8.4 Component spacing

| Token | Suggested value |
|---|---:|
| `web.spacing.card.padding.sm` | `16px` |
| `web.spacing.card.padding.md` | `20px` |
| `web.spacing.card.padding.lg` | `24px` |
| `web.spacing.form.fieldGap` | `16px` |
| `web.spacing.form.groupGap` | `24px` |
| `web.spacing.grid.gap.sm` | `16px` |
| `web.spacing.grid.gap.md` | `24px` |
| `web.spacing.grid.gap.lg` | `32px` |
| `web.spacing.stack.xs` | `8px` |
| `web.spacing.stack.sm` | `12px` |
| `web.spacing.stack.md` | `16px` |
| `web.spacing.stack.lg` | `24px` |
| `web.spacing.stack.xl` | `32px` |

---

## 9. Layout Tokens

### 9.1 Containers

| Token | Suggested value | Usage |
|---|---:|---|
| `web.layout.container.xs` | `640px` | Small content |
| `web.layout.container.sm` | `768px` | Article/narrow |
| `web.layout.container.md` | `1024px` | Content |
| `web.layout.container.lg` | `1280px` | Main layout |
| `web.layout.container.xl` | `1440px` | Wide commerce grid |
| `web.layout.container.full` | `100%` | Full bleed |

### 9.2 Header/footer

| Token | Suggested value |
|---|---:|
| `web.layout.header.height.mobile` | `64px` |
| `web.layout.header.height.desktop` | `80px` |
| `web.layout.header.stickyOffset` | `0px` |
| `web.layout.footer.paddingY.mobile` | `48px` |
| `web.layout.footer.paddingY.desktop` | `72px` |

### 9.3 Product layout

| Token | Suggested value |
|---|---:|
| `web.layout.productGrid.minCardWidth` | `220px` |
| `web.layout.productGrid.maxColumns.mobile` | `2` |
| `web.layout.productGrid.maxColumns.tablet` | `3` |
| `web.layout.productGrid.maxColumns.desktop` | `4` |
| `web.layout.productGrid.maxColumns.wide` | `5` |
| `web.layout.pdp.galleryWidth.desktop` | `58%` |
| `web.layout.pdp.summaryWidth.desktop` | `42%` |
| `web.layout.pdp.stickyTop` | `96px` |

### 9.4 Content layout

| Token | Suggested value |
|---|---:|
| `web.layout.article.maxWidth` | `760px` |
| `web.layout.policy.maxWidth` | `860px` |
| `web.layout.checkout.maxWidth` | `1180px` |
| `web.layout.cart.maxWidth` | `1180px` |

---

## 10. Breakpoint Tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `web.breakpoint.xs` | `360px` | Small mobile |
| `web.breakpoint.sm` | `640px` | Mobile large |
| `web.breakpoint.md` | `768px` | Tablet |
| `web.breakpoint.lg` | `1024px` | Desktop |
| `web.breakpoint.xl` | `1280px` | Large desktop |
| `web.breakpoint.2xl` | `1536px` | Wide screen |

Rules:

- Mobile-first.
- Product grid adapts by card width, not only viewport.
- Header/nav behavior must switch cleanly.
- Checkout/PDP must avoid cramped side-by-side layout on small screens.

---

## 11. Radius Tokens

### 11.1 Radius scale

| Token | Suggested value | Usage |
|---|---:|---|
| `web.radius.none` | `0` | Sharp brand shape |
| `web.radius.xs` | `2px` | Small details |
| `web.radius.sm` | `4px` | Buttons/badges |
| `web.radius.md` | `8px` | Cards/inputs |
| `web.radius.lg` | `12px` | Product cards |
| `web.radius.xl` | `16px` | Large panels |
| `web.radius.2xl` | `24px` | Hero/media blocks if needed |
| `web.radius.full` | `999px` | Pill/chips |

### 11.2 Semantic radius

| Token | Suggested value |
|---|---:|
| `web.radius.button` | `4px` |
| `web.radius.input` | `6px` |
| `web.radius.card` | `12px` |
| `web.radius.productCard` | `12px` |
| `web.radius.image` | `10px` |
| `web.radius.badge` | `4px` |
| `web.radius.chip` | `999px` |
| `web.radius.modal` | `16px` |

Rule:

- BigBike nên sắc, mạnh, hơi mechanical.
- Không bo góc quá cute.
- CTA có thể hơi vuông/chamfer style nếu implementation hỗ trợ.

---

## 12. Border Tokens

### 12.1 Border width

| Token | Suggested value |
|---|---:|
| `web.border.width.none` | `0` |
| `web.border.width.sm` | `1px` |
| `web.border.width.md` | `2px` |

### 12.2 Semantic border

| Token | Suggested value |
|---|---|
| `web.border.dark.subtle` | `1px solid web.color.border.darkSubtle` |
| `web.border.dark.default` | `1px solid web.color.border.darkDefault` |
| `web.border.light.subtle` | `1px solid web.color.border.lightSubtle` |
| `web.border.light.default` | `1px solid web.color.border.lightDefault` |
| `web.border.focus` | `2px solid web.color.border.focus` |
| `web.border.brand` | `1px solid web.color.border.brand` |
| `web.border.error` | `1px solid web.color.border.error` |

---

## 13. Shadow / Elevation Tokens

### 13.1 Shadow scale

| Token | Suggested value | Usage |
|---|---|---|
| `web.shadow.none` | `none` | Flat |
| `web.shadow.sm` | `0 2px 8px rgba(0,0,0,0.24)` | Small card |
| `web.shadow.md` | `0 8px 24px rgba(0,0,0,0.32)` | Product card hover |
| `web.shadow.lg` | `0 18px 48px rgba(0,0,0,0.42)` | Hero/modal |
| `web.shadow.brand` | `0 12px 30px rgba(249,6,6,0.22)` | Primary CTA/product accent |
| `web.shadow.focus` | `0 0 0 3px rgba(249,6,6,0.36)` | Focus ring |

### 13.2 Usage

- Product card can use subtle hover shadow.
- CTA can use brand shadow carefully.
- Article/content cards should be calmer.
- Do not use huge shadow everywhere.

---

## 14. Motion Tokens

### 14.1 Duration

| Token | Suggested value |
|---|---:|
| `web.motion.duration.instant` | `80ms` |
| `web.motion.duration.fast` | `140ms` |
| `web.motion.duration.normal` | `220ms` |
| `web.motion.duration.slow` | `360ms` |
| `web.motion.duration.hero` | `600ms` |

### 14.2 Easing

| Token | Suggested value |
|---|---|
| `web.motion.easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` |
| `web.motion.easing.exit` | `cubic-bezier(0.4, 0, 1, 1)` |
| `web.motion.easing.emphasized` | `cubic-bezier(0.2, 0, 0, 1.12)` |

### 14.3 Motion rules

Use motion for:

- CTA hover/press.
- Product card hover.
- Menu/drawer open.
- Modal transition.
- Toast.
- Add-to-cart feedback.
- Skeleton loading.

Avoid:

- Long bouncy animation.
- Heavy parallax by default.
- Animation that hurts Core Web Vitals.
- Animation that ignores `prefers-reduced-motion`.

---

## 15. Z-index Tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `web.zIndex.base` | `0` | Base |
| `web.zIndex.raised` | `10` | Raised card |
| `web.zIndex.sticky` | `100` | Sticky CTA/filter |
| `web.zIndex.header` | `200` | Header |
| `web.zIndex.dropdown` | `300` | Desktop dropdown |
| `web.zIndex.mobileMenu` | `400` | Mobile nav |
| `web.zIndex.overlay` | `500` | Overlay |
| `web.zIndex.modal` | `600` | Modal |
| `web.zIndex.toast` | `700` | Toast/chat feedback |

Không dùng `999999`. Cái đó không phải z-index, đó là tiếng kêu cứu của CSS.

---

## 16. Button Tokens

### 16.1 Sizing

| Token | Suggested value |
|---|---:|
| `web.button.height.sm` | `36px` |
| `web.button.height.md` | `44px` |
| `web.button.height.lg` | `52px` |
| `web.button.height.xl` | `60px` |
| `web.button.paddingX.sm` | `14px` |
| `web.button.paddingX.md` | `20px` |
| `web.button.paddingX.lg` | `28px` |
| `web.button.gap` | `8px` |
| `web.button.radius` | `web.radius.button` |

### 16.2 Typography

| Token | Suggested value |
|---|---|
| `web.button.fontFamily` | `web.typography.font.ui` |
| `web.button.fontSize.sm` | `14px` |
| `web.button.fontSize.md` | `14px` |
| `web.button.fontSize.lg` | `16px` |
| `web.button.fontWeight` | `700` |
| `web.button.letterSpacing` | `0.04em` |
| `web.button.textTransform` | `uppercase` |

### 16.3 Primary button

| Token | Value |
|---|---|
| `web.button.primary.background.default` | `web.color.action.primary.background.default` |
| `web.button.primary.background.hover` | `web.color.action.primary.background.hover` |
| `web.button.primary.background.active` | `web.color.action.primary.background.active` |
| `web.button.primary.text` | `web.color.action.primary.text` |
| `web.button.primary.border` | `transparent` |
| `web.button.primary.shadow` | `web.shadow.brand` |

### 16.4 Secondary dark button

| Token | Value |
|---|---|
| `web.button.secondaryDark.background.default` | `transparent` |
| `web.button.secondaryDark.background.hover` | `rgba(255,255,255,0.08)` |
| `web.button.secondaryDark.text` | `web.color.action.secondary.text.dark` |
| `web.button.secondaryDark.border` | `web.color.action.secondary.border.dark` |

### 16.5 Secondary light button

| Token | Value |
|---|---|
| `web.button.secondaryLight.background.default` | `web.color.action.secondary.background.light` |
| `web.button.secondaryLight.background.hover` | `#F9FAFB` |
| `web.button.secondaryLight.text` | `web.color.action.secondary.text.light` |
| `web.button.secondaryLight.border` | `web.color.action.secondary.border.light` |

### 16.6 Disabled/loading

| Token | Suggested value |
|---|---|
| `web.button.disabled.opacity` | `0.48` |
| `web.button.disabled.cursor` | `not-allowed` |
| `web.button.loading.opacity` | `0.72` |

---

## 17. Input / Form Tokens

### 17.1 Input sizing

| Token | Suggested value |
|---|---:|
| `web.input.height.sm` | `40px` |
| `web.input.height.md` | `48px` |
| `web.input.height.lg` | `56px` |
| `web.input.paddingX` | `14px` |
| `web.input.radius` | `web.radius.input` |
| `web.input.fontSize` | `16px` |

### 17.2 Dark input

| Token | Value |
|---|---|
| `web.input.dark.background.default` | `web.color.surface.inputDark` |
| `web.input.dark.background.hover` | `#191919` |
| `web.input.dark.text` | `web.color.text.primaryDark` |
| `web.input.dark.placeholder` | `web.color.text.mutedDark` |
| `web.input.dark.border.default` | `web.color.border.darkDefault` |
| `web.input.dark.border.focus` | `web.color.border.focus` |
| `web.input.dark.border.error` | `web.color.border.error` |

### 17.3 Light input

| Token | Value |
|---|---|
| `web.input.light.background.default` | `web.color.surface.inputLight` |
| `web.input.light.background.hover` | `#FFFFFF` |
| `web.input.light.text` | `web.color.text.primaryLight` |
| `web.input.light.placeholder` | `web.color.text.mutedLight` |
| `web.input.light.border.default` | `web.color.border.lightDefault` |
| `web.input.light.border.focus` | `web.color.border.focus` |
| `web.input.light.border.error` | `web.color.border.error` |

### 17.4 Form labels

| Token | Suggested value |
|---|---|
| `web.form.label.fontSize` | `14px` |
| `web.form.label.fontWeight` | `600` |
| `web.form.label.color.dark` | `web.color.text.primaryDark` |
| `web.form.label.color.light` | `web.color.text.primaryLight` |
| `web.form.required.color` | `web.color.text.brand` |
| `web.form.helper.fontSize` | `12px` |
| `web.form.error.color` | `web.color.status.error.text` |

---

## 18. Header Tokens

### 18.1 Header base

| Token | Suggested value |
|---|---|
| `web.header.background.default` | `rgba(10,10,10,0.92)` |
| `web.header.background.scrolled` | `rgba(10,10,10,0.96)` |
| `web.header.backdropFilter` | `blur(12px)` |
| `web.header.borderBottom` | `web.color.border.darkSubtle` |
| `web.header.height.mobile` | `web.layout.header.height.mobile` |
| `web.header.height.desktop` | `web.layout.header.height.desktop` |
| `web.header.zIndex` | `web.zIndex.header` |

### 18.2 Header nav

| Token | Suggested value |
|---|---|
| `web.header.nav.text.default` | `web.color.text.secondaryDark` |
| `web.header.nav.text.hover` | `web.color.text.primaryDark` |
| `web.header.nav.text.active` | `web.color.text.brand` |
| `web.header.nav.indicator` | `web.color.action.primary.background.default` |
| `web.header.nav.gap` | `24px` |

### 18.3 Cart/search indicators

| Token | Suggested value |
|---|---|
| `web.header.cartBadge.background` | `web.color.action.primary.background.default` |
| `web.header.cartBadge.text` | `web.color.text.inverse` |
| `web.header.search.width.desktop` | `320px` |

---

## 19. Footer Tokens

| Token | Suggested value |
|---|---|
| `web.footer.background` | `#0A0A0A` |
| `web.footer.text.primary` | `web.color.text.primaryDark` |
| `web.footer.text.secondary` | `web.color.text.secondaryDark` |
| `web.footer.text.muted` | `web.color.text.mutedDark` |
| `web.footer.link.default` | `web.color.text.secondaryDark` |
| `web.footer.link.hover` | `web.color.text.brand` |
| `web.footer.borderTop` | `web.color.border.darkSubtle` |
| `web.footer.paddingY.mobile` | `web.layout.footer.paddingY.mobile` |
| `web.footer.paddingY.desktop` | `web.layout.footer.paddingY.desktop` |

---

## 20. Hero Tokens

### 20.1 Hero layout

| Token | Suggested value |
|---|---:|
| `web.hero.minHeight.mobile` | `560px` |
| `web.hero.minHeight.desktop` | `720px` |
| `web.hero.paddingY.mobile` | `80px` |
| `web.hero.paddingY.desktop` | `120px` |
| `web.hero.content.maxWidth` | `640px` |
| `web.hero.visual.maxWidth` | `720px` |

### 20.2 Hero colors

| Token | Suggested value |
|---|---|
| `web.hero.background.base` | `web.color.background.section.black` |
| `web.hero.background.overlay` | `linear-gradient(90deg, rgba(10,10,10,0.96) 0%, rgba(10,10,10,0.78) 42%, rgba(10,10,10,0.32) 100%)` |
| `web.hero.title.color` | `web.color.text.primaryDark` |
| `web.hero.subtitle.color` | `web.color.text.secondaryDark` |
| `web.hero.accent.color` | `web.color.text.brand` |

### 20.3 Hero typography

| Token | Suggested value |
|---|---|
| `web.hero.title.fontFamily` | `web.typography.font.display` |
| `web.hero.title.fontSize` | `web.typography.size.hero` |
| `web.hero.title.lineHeight` | `web.typography.lineHeight.tight` |
| `web.hero.subtitle.fontSize` | `18px` |
| `web.hero.subtitle.lineHeight` | `1.65` |

Rule:

- Hero title can be Bungee.
- Keep subtitle Exo and readable.
- Do not place text on noisy image without overlay.

---

## 21. Card Tokens

### 21.1 Base card

| Token | Suggested value |
|---|---|
| `web.card.background.dark` | `web.color.surface.card.dark` |
| `web.card.background.darkHover` | `web.color.surface.card.darkHover` |
| `web.card.background.light` | `web.color.surface.card.light` |
| `web.card.border.dark` | `web.color.border.darkSubtle` |
| `web.card.border.light` | `web.color.border.lightSubtle` |
| `web.card.radius` | `web.radius.card` |
| `web.card.shadow.default` | `web.shadow.sm` |
| `web.card.shadow.hover` | `web.shadow.md` |
| `web.card.padding` | `web.spacing.card.padding.md` |

### 21.2 Hover

| Token | Suggested value |
|---|---|
| `web.card.hover.translateY` | `-2px` |
| `web.card.hover.transition` | `web.motion.duration.normal web.motion.easing.standard` |
| `web.card.hover.border` | `web.color.border.brand` |

---

## 22. Product Card Tokens

### 22.1 Product card layout

| Token | Suggested value |
|---|---:|
| `web.productCard.width.min` | `220px` |
| `web.productCard.image.aspectRatio` | `1 / 1` |
| `web.productCard.padding` | `16px` |
| `web.productCard.gap` | `12px` |
| `web.productCard.radius` | `web.radius.productCard` |

### 22.2 Product card colors

| Token | Suggested value |
|---|---|
| `web.productCard.background.default` | `web.color.surface.card.dark` |
| `web.productCard.background.hover` | `web.color.surface.card.darkHover` |
| `web.productCard.border.default` | `web.color.border.darkSubtle` |
| `web.productCard.border.hover` | `web.color.border.brand` |
| `web.productCard.imageBackground` | `radial-gradient(circle at 50% 20%, rgba(255,255,255,0.10), transparent 34%), #191919` |
| `web.productCard.name.color` | `web.color.text.primaryDark` |
| `web.productCard.meta.color` | `web.color.text.mutedDark` |
| `web.productCard.price.color` | `web.color.product.price` |
| `web.productCard.comparePrice.color` | `web.color.product.comparePrice` |

### 22.3 Product card typography

| Token | Suggested value |
|---|---|
| `web.productCard.name.fontFamily` | `web.typography.font.body` |
| `web.productCard.name.fontSize` | `15px` |
| `web.productCard.name.fontWeight` | `600` |
| `web.productCard.name.lineHeight` | `1.45` |
| `web.productCard.price.fontSize` | `18px` |
| `web.productCard.price.fontWeight` | `700` |
| `web.productCard.meta.fontSize` | `12px` |

### 22.4 Product card states

| Token | Suggested value |
|---|---|
| `web.productCard.outOfStock.opacity` | `0.58` |
| `web.productCard.loading.background` | `web.color.surface.card.dark` |
| `web.productCard.skeleton.background` | `rgba(255,255,255,0.10)` |

---

## 23. Category Card Tokens

| Token | Suggested value |
|---|---|
| `web.categoryCard.background.default` | `web.color.surface.card.dark` |
| `web.categoryCard.background.hover` | `web.color.surface.card.darkHover` |
| `web.categoryCard.border.default` | `web.color.border.darkSubtle` |
| `web.categoryCard.border.hover` | `web.color.border.brand` |
| `web.categoryCard.radius` | `web.radius.card` |
| `web.categoryCard.padding` | `24px` |
| `web.categoryCard.icon.size` | `40px` |
| `web.categoryCard.title.color` | `web.color.text.primaryDark` |
| `web.categoryCard.description.color` | `web.color.text.secondaryDark` |

---

## 24. Badge Tokens

### 24.1 Badge sizing

| Token | Suggested value |
|---|---:|
| `web.badge.height.sm` | `22px` |
| `web.badge.height.md` | `26px` |
| `web.badge.paddingX.sm` | `8px` |
| `web.badge.paddingX.md` | `10px` |
| `web.badge.radius` | `web.radius.badge` |
| `web.badge.fontSize` | `12px` |
| `web.badge.fontWeight` | `700` |
| `web.badge.letterSpacing` | `0.04em` |

### 24.2 Badge variants

```text
web.badge.sale.background = web.color.product.sale.background
web.badge.sale.text = web.color.product.sale.text

web.badge.new.background = web.color.status.info.background
web.badge.new.text = web.color.status.info.text
web.badge.new.border = web.color.status.info.border

web.badge.featured.background = web.color.status.campaign.background
web.badge.featured.text = web.color.status.campaign.text
web.badge.featured.border = web.color.status.campaign.border

web.badge.stockIn.background = web.color.status.success.background
web.badge.stockIn.text = web.color.status.success.text
web.badge.stockIn.border = web.color.status.success.border

web.badge.stockLow.background = web.color.status.warning.background
web.badge.stockLow.text = web.color.status.warning.text
web.badge.stockLow.border = web.color.status.warning.border

web.badge.stockOut.background = web.color.status.neutral.background
web.badge.stockOut.text = web.color.status.neutral.text
web.badge.stockOut.border = web.color.status.neutral.border

web.badge.preorder.background = web.color.status.info.background
web.badge.preorder.text = web.color.status.info.text
web.badge.preorder.border = web.color.status.info.border
```

---

## 25. Search & Filter Tokens

### 25.1 Search

| Token | Suggested value |
|---|---|
| `web.search.input.height.mobile` | `48px` |
| `web.search.input.height.desktop` | `44px` |
| `web.search.input.background.dark` | `web.color.surface.inputDark` |
| `web.search.input.border.dark` | `web.color.border.darkDefault` |
| `web.search.input.text.dark` | `web.color.text.primaryDark` |
| `web.search.suggestion.background` | `web.color.surface.card.dark` |
| `web.search.suggestion.border` | `web.color.border.darkSubtle` |
| `web.search.suggestion.shadow` | `web.shadow.lg` |
| `web.search.suggestion.width.desktop` | `420px` |

### 25.2 Filters

| Token | Suggested value |
|---|---|
| `web.filter.sidebar.width.desktop` | `280px` |
| `web.filter.drawer.width.mobile` | `100%` |
| `web.filter.chip.height` | `32px` |
| `web.filter.chip.radius` | `web.radius.chip` |
| `web.filter.chip.background.default` | `web.color.surface.card.dark` |
| `web.filter.chip.background.active` | `web.color.surface.selected` |
| `web.filter.chip.border.default` | `web.color.border.darkDefault` |
| `web.filter.chip.border.active` | `web.color.border.brand` |
| `web.filter.chip.text.default` | `web.color.text.secondaryDark` |
| `web.filter.chip.text.active` | `web.color.text.brand` |

---

## 26. Breadcrumb Tokens

| Token | Suggested value |
|---|---|
| `web.breadcrumb.fontSize` | `13px` |
| `web.breadcrumb.text.default` | `web.color.text.mutedDark` |
| `web.breadcrumb.text.hover` | `web.color.text.primaryDark` |
| `web.breadcrumb.text.current` | `web.color.text.secondaryDark` |
| `web.breadcrumb.separator.color` | `web.color.text.mutedDark` |
| `web.breadcrumb.gap` | `8px` |
| `web.breadcrumb.marginBottom` | `20px` |

Light page variants should map to `primaryLight/secondaryLight/mutedLight`.

---

## 27. PDP Tokens

### 27.1 PDP layout

| Token | Suggested value |
|---|---:|
| `web.pdp.sectionGap` | `48px` |
| `web.pdp.gallery.gap` | `12px` |
| `web.pdp.gallery.mainImage.aspectRatio` | `1 / 1` |
| `web.pdp.gallery.thumbnail.size` | `72px` |
| `web.pdp.gallery.thumbnail.radius` | `web.radius.sm` |
| `web.pdp.summary.stickyTop` | `web.layout.pdp.stickyTop` |
| `web.pdp.summary.gap` | `20px` |

### 27.2 PDP typography

| Token | Suggested value |
|---|---|
| `web.pdp.title.fontFamily` | `web.typography.font.body` |
| `web.pdp.title.fontSize.mobile` | `28px` |
| `web.pdp.title.fontSize.desktop` | `40px` |
| `web.pdp.title.fontWeight` | `700` |
| `web.pdp.title.lineHeight` | `1.18` |
| `web.pdp.price.fontSize.mobile` | `28px` |
| `web.pdp.price.fontSize.desktop` | `36px` |
| `web.pdp.price.color` | `web.color.product.price` |
| `web.pdp.price.fontWeight` | `700` |

### 27.3 Variant selector

| Token | Suggested value |
|---|---|
| `web.pdp.variant.height` | `40px` |
| `web.pdp.variant.paddingX` | `14px` |
| `web.pdp.variant.radius` | `web.radius.button` |
| `web.pdp.variant.background.default` | `web.color.surface.card.dark` |
| `web.pdp.variant.background.selected` | `web.color.surface.selected` |
| `web.pdp.variant.border.default` | `web.color.border.darkDefault` |
| `web.pdp.variant.border.selected` | `web.color.border.brand` |
| `web.pdp.variant.text.default` | `web.color.text.secondaryDark` |
| `web.pdp.variant.text.selected` | `web.color.text.primaryDark` |
| `web.pdp.variant.disabled.opacity` | `0.42` |

### 27.4 Trust strip

| Token | Suggested value |
|---|---|
| `web.pdp.trust.background` | `web.color.surface.card.dark` |
| `web.pdp.trust.border` | `web.color.border.darkSubtle` |
| `web.pdp.trust.radius` | `web.radius.card` |
| `web.pdp.trust.padding` | `16px` |
| `web.pdp.trust.icon.color` | `web.color.text.brand` |
| `web.pdp.trust.title.color` | `web.color.text.primaryDark` |
| `web.pdp.trust.text.color` | `web.color.text.secondaryDark` |

---

## 28. Cart Tokens

### 28.1 Cart layout

| Token | Suggested value |
|---|---:|
| `web.cart.item.gap` | `16px` |
| `web.cart.item.padding` | `16px` |
| `web.cart.item.image.size.mobile` | `80px` |
| `web.cart.item.image.size.desktop` | `96px` |
| `web.cart.summary.width.desktop` | `360px` |
| `web.cart.summary.stickyTop` | `96px` |

### 28.2 Cart colors

| Token | Suggested value |
|---|---|
| `web.cart.item.background` | `web.color.surface.card.dark` |
| `web.cart.item.border` | `web.color.border.darkSubtle` |
| `web.cart.summary.background` | `web.color.surface.card.dark` |
| `web.cart.summary.border` | `web.color.border.darkSubtle` |
| `web.cart.total.color` | `web.color.product.price` |
| `web.cart.remove.color` | `web.color.status.error.text` |

### 28.3 Quantity selector

| Token | Suggested value |
|---|---|
| `web.quantity.height` | `40px` |
| `web.quantity.button.size` | `40px` |
| `web.quantity.input.width` | `56px` |
| `web.quantity.background` | `web.color.surface.inputDark` |
| `web.quantity.border` | `web.color.border.darkDefault` |
| `web.quantity.text` | `web.color.text.primaryDark` |

---

## 29. Checkout Tokens

### 29.1 Checkout layout

| Token | Suggested value |
|---|---:|
| `web.checkout.grid.gap` | `32px` |
| `web.checkout.form.maxWidth` | `720px` |
| `web.checkout.summary.width.desktop` | `400px` |
| `web.checkout.summary.stickyTop` | `96px` |
| `web.checkout.sectionGap` | `24px` |

### 29.2 Checkout surfaces

| Token | Suggested value |
|---|---|
| `web.checkout.form.background` | `web.color.surface.card.dark` |
| `web.checkout.form.border` | `web.color.border.darkSubtle` |
| `web.checkout.summary.background` | `web.color.surface.card.dark` |
| `web.checkout.summary.border` | `web.color.border.darkSubtle` |
| `web.checkout.notice.background` | `web.color.status.info.background` |
| `web.checkout.notice.text` | `web.color.status.info.text` |
| `web.checkout.error.background` | `web.color.status.error.background` |
| `web.checkout.error.text` | `web.color.status.error.text` |

### 29.3 Checkout CTA

| Token | Suggested value |
|---|---|
| `web.checkout.submit.height` | `56px` |
| `web.checkout.submit.background` | `web.color.action.primary.background.default` |
| `web.checkout.submit.text` | `web.color.action.primary.text` |
| `web.checkout.submit.shadow` | `web.shadow.brand` |

---

## 30. Content / SEO Tokens

### 30.1 Article typography

| Token | Suggested value |
|---|---|
| `web.content.article.maxWidth` | `web.layout.article.maxWidth` |
| `web.content.article.fontFamily` | `web.typography.font.body` |
| `web.content.article.fontSize` | `18px` |
| `web.content.article.lineHeight` | `1.75` |
| `web.content.article.text.color.dark` | `web.color.text.primaryDark` |
| `web.content.article.text.color.light` | `web.color.text.primaryLight` |
| `web.content.article.link.color` | `web.color.text.brand` |
| `web.content.article.heading.color.dark` | `web.color.text.primaryDark` |
| `web.content.article.heading.color.light` | `web.color.text.primaryLight` |

### 30.2 Article spacing

| Token | Suggested value |
|---|---:|
| `web.content.article.paragraphGap` | `20px` |
| `web.content.article.headingMarginTop` | `40px` |
| `web.content.article.headingMarginBottom` | `16px` |
| `web.content.article.imageMarginY` | `32px` |
| `web.content.article.listGap` | `8px` |

### 30.3 Policy/help page

| Token | Suggested value |
|---|---:|
| `web.content.policy.maxWidth` | `web.layout.policy.maxWidth` |
| `web.content.policy.sectionGap` | `32px` |
| `web.content.policy.cardPadding` | `24px` |

---

## 31. Modal / Drawer Tokens

### 31.1 Modal

| Token | Suggested value |
|---|---|
| `web.modal.overlay.background` | `rgba(10,10,10,0.72)` |
| `web.modal.background` | `web.color.surface.card.dark` |
| `web.modal.border` | `web.color.border.darkSubtle` |
| `web.modal.radius` | `web.radius.modal` |
| `web.modal.shadow` | `web.shadow.lg` |
| `web.modal.width.sm` | `420px` |
| `web.modal.width.md` | `560px` |
| `web.modal.width.lg` | `760px` |
| `web.modal.padding` | `24px` |

### 31.2 Mobile drawer / filter drawer

| Token | Suggested value |
|---|---|
| `web.drawer.background` | `web.color.surface.card.dark` |
| `web.drawer.border` | `web.color.border.darkSubtle` |
| `web.drawer.shadow` | `web.shadow.lg` |
| `web.drawer.width.mobile` | `100%` |
| `web.drawer.width.desktop` | `420px` |
| `web.drawer.padding` | `20px` |

---

## 32. Toast / Feedback Tokens

| Token | Suggested value |
|---|---|
| `web.toast.background` | `web.color.surface.card.dark` |
| `web.toast.text` | `web.color.text.primaryDark` |
| `web.toast.border` | `web.color.border.darkSubtle` |
| `web.toast.radius` | `web.radius.card` |
| `web.toast.shadow` | `web.shadow.lg` |
| `web.toast.paddingX` | `16px` |
| `web.toast.paddingY` | `12px` |
| `web.toast.maxWidth` | `420px` |
| `web.toast.success.iconColor` | `web.color.status.success.text` |
| `web.toast.error.iconColor` | `web.color.status.error.text` |
| `web.toast.info.iconColor` | `web.color.status.info.text` |

---

## 33. Empty / Loading / Error Tokens

### 33.1 Empty state

| Token | Suggested value |
|---|---|
| `web.emptyState.paddingY` | `64px` |
| `web.emptyState.icon.size` | `56px` |
| `web.emptyState.icon.color` | `web.color.text.mutedDark` |
| `web.emptyState.title.color` | `web.color.text.primaryDark` |
| `web.emptyState.description.color` | `web.color.text.secondaryDark` |
| `web.emptyState.actionGap` | `12px` |

### 33.2 Skeleton

| Token | Suggested value |
|---|---|
| `web.skeleton.background.dark` | `rgba(255,255,255,0.10)` |
| `web.skeleton.highlight.dark` | `rgba(255,255,255,0.16)` |
| `web.skeleton.background.light` | `#E5E7EB` |
| `web.skeleton.highlight.light` | `#F3F4F6` |
| `web.skeleton.radius` | `web.radius.sm` |
| `web.skeleton.animation.duration` | `1200ms` |

### 33.3 Error state

| Token | Suggested value |
|---|---|
| `web.errorState.background` | `web.color.status.error.background` |
| `web.errorState.text` | `web.color.status.error.text` |
| `web.errorState.border` | `web.color.status.error.border` |
| `web.errorState.icon.color` | `web.color.status.error.text` |

---

## 34. SEO / Metadata Token Guidance

SEO không phải visual token thuần túy, nhưng UI implementation cần constants/semantic mapping.

### 34.1 OG image sizes

| Token | Suggested value |
|---|---:|
| `web.seo.ogImage.width` | `1200px` |
| `web.seo.ogImage.height` | `630px` |
| `web.seo.twitterImage.width` | `1200px` |
| `web.seo.twitterImage.height` | `630px` |

### 34.2 Content image ratios

| Token | Suggested value |
|---|---|
| `web.image.ratio.product` | `1 / 1` |
| `web.image.ratio.categoryHero` | `16 / 9` |
| `web.image.ratio.articleCover` | `16 / 9` |
| `web.image.ratio.banner` | `21 / 9` |
| `web.image.ratio.social` | `1200 / 630` |

### 34.3 Image loading guidance

| Token | Suggested value |
|---|---|
| `web.image.loading.hero` | `priority/eager when above-the-fold` |
| `web.image.loading.productGrid` | `lazy below fold` |
| `web.image.loading.articleBelowFold` | `lazy` |

---

## 35. CSS Variable Mapping Example

Nếu implement bằng CSS variables:

```css
:root {
  --web-color-brand-red: #F90606;
  --web-color-background-page: #0A0A0A;
  --web-color-background-section-dark: #191919;

  --web-color-surface-card-dark: #141414;
  --web-color-surface-card-hover: #202020;

  --web-color-text-primary-dark: rgba(255, 255, 255, 0.96);
  --web-color-text-secondary-dark: rgba(255, 255, 255, 0.74);
  --web-color-text-muted-dark: rgba(255, 255, 255, 0.56);
  --web-color-text-brand: #F90606;
  --web-color-product-price: #F90606;

  --web-color-border-dark-subtle: rgba(255, 255, 255, 0.10);
  --web-color-border-brand: rgba(249, 6, 6, 0.44);

  --web-font-display: "Bungee", "Exo", "Inter", Arial, sans-serif;
  --web-font-body: "Exo", "Inter", Arial, sans-serif;

  --web-radius-button: 4px;
  --web-radius-card: 12px;
  --web-radius-product-card: 12px;

  --web-header-height-mobile: 64px;
  --web-header-height-desktop: 80px;
  --web-container-xl: 1440px;
}
```

Đây là mapping example, không bắt buộc copy 1:1 nếu stack dùng Tailwind/theme object/token pipeline.

---

## 36. TypeScript Token Mapping Example

Nếu implement bằng TypeScript object:

```ts
export const webTokens = {
  color: {
    brand: {
      red: "#F90606",
    },
    background: {
      page: "#0A0A0A",
      sectionDark: "#191919",
    },
    surface: {
      cardDark: "#141414",
      cardDarkHover: "#202020",
    },
    text: {
      primaryDark: "rgba(255,255,255,0.96)",
      secondaryDark: "rgba(255,255,255,0.74)",
      mutedDark: "rgba(255,255,255,0.56)",
      brand: "#F90606",
    },
    product: {
      price: "#F90606",
      sale: "#F90606",
    },
  },
  typography: {
    fontDisplay: `"Bungee", "Exo", "Inter", Arial, sans-serif`,
    fontBody: `"Exo", "Inter", Arial, sans-serif`,
  },
  radius: {
    button: 4,
    card: 12,
    productCard: 12,
  },
  layout: {
    headerMobile: 64,
    headerDesktop: 80,
    containerXl: 1440,
  },
} as const;
```

Rule:

- Token object phải read-only.
- Component dùng token object hoặc CSS variables.
- Không hardcode raw style nếu token đã có.

---

## 37. Tailwind Mapping Guidance

Nếu `bigbike-web` dùng Tailwind, map token vào `theme.extend`.

Suggested mapping:

```text
colors.web.bg
colors.web.surface.card
colors.web.text.primary
colors.web.text.secondary
colors.web.brand
colors.web.price
colors.web.border
colors.web.status.success.bg
colors.web.status.success.text

fontFamily.display
fontFamily.body

borderRadius.web-button
borderRadius.web-card
boxShadow.web-card
boxShadow.web-brand
```

Avoid arbitrary value spam:

```tsx
className="bg-[#141414] text-[#FFFFFF] px-[19px] rounded-[11px]"
```

Accept arbitrary value only when:

- Case kỹ thuật hẹp.
- Không lặp lại.
- Có lý do rõ.
- Không nên thành pattern.

---

## 38. Token Usage Rules for AI Agents

AI agent khi sửa `bigbike-web` phải:

1. Đọc `BRAND_GUIDELINES.md`.
2. Đọc `DESIGN_SYSTEM.md`.
3. Đọc `WEB_DESIGN.md`.
4. Đọc `WEB_DESIGN_TOKENS.md`.
5. Dùng semantic tokens trước primitive tokens.
6. Không hardcode màu, spacing, font, radius nếu token đã có.
7. Không copy admin token sang web nếu làm web quá dense/nhạt.
8. Không tạo token mới nếu không có semantic rõ.
9. Không dùng red cho mọi thứ.
10. Không dùng Bungee cho paragraph/spec/body dài.
11. Không tạo random gradient ngoài brand direction.
12. Không phá mobile-first.
13. Không bỏ qua SEO readability.
14. Không bỏ qua loading/empty/error states.
15. Không dùng image/video token nặng làm chết Core Web Vitals.

---

## 39. Token Review Checklist

Trước khi merge UI hoặc token changes:

### General

- [ ] Token có semantic name.
- [ ] Không hardcode raw color trong component.
- [ ] Không tạo token mới thiếu lý do.
- [ ] Token không trùng nghĩa với token đã có.
- [ ] Token không lệch brand direction.

### Brand

- [ ] BigBike Red dùng cho CTA/price/sale/active có kiểm soát.
- [ ] Dark/black giữ đúng mood.
- [ ] Supporting colors không cạnh tranh với red.
- [ ] Logo/icon asset không bị style phá vỡ.

### Typography

- [ ] Bungee chỉ dùng cho display/campaign/hero.
- [ ] Exo dùng cho body/UI/product/content.
- [ ] Article text đủ readable.
- [ ] Product name/price dễ scan.

### Commerce

- [ ] Product card có price, image, CTA/status rõ.
- [ ] PDP token hỗ trợ gallery, variant, CTA, trust.
- [ ] Cart/checkout token hỗ trợ sticky summary và mobile.
- [ ] Badge/status có text + color.

### Spacing / layout

- [ ] Spacing theo 4px scale.
- [ ] Section spacing phù hợp public web.
- [ ] Product grid responsive.
- [ ] Header/footer tokens rõ.
- [ ] No random one-off spacing.

### Accessibility

- [ ] Focus ring visible.
- [ ] Contrast đủ đọc.
- [ ] Color không phải tín hiệu duy nhất.
- [ ] Touch target đủ lớn.
- [ ] Reduced motion có fallback.

### Performance / SEO

- [ ] Hero/PDP image token không gây CLS.
- [ ] Content layout hỗ trợ semantic HTML.
- [ ] Image ratios rõ.
- [ ] Không dùng video/animation token quá nặng.
- [ ] Mobile-first không bị vỡ.

---

## 40. Relationship With Other Docs

### `BRAND_GUIDELINES.md`

Nguồn chuẩn cho:

- Brand identity.
- Logo.
- Màu gốc.
- Typeface.
- Visual mood.
- Asset rules.

### `DESIGN_SYSTEM.md`

Nguồn chuẩn cho:

- Shared UI rules.
- Component behavior.
- State design.
- Accessibility.
- Responsive principles.

### `WEB_DESIGN.md`

Nguồn chuẩn cho:

- Public website UX.
- SEO/commerce page behavior.
- Homepage/category/PDP/cart/checkout/content rules.

### `WEB_DESIGN_TOKENS.md`

Nguồn chuẩn cho:

- Web token semantics.
- Web implementation values.
- Web component token mapping.
- Commerce/SEO visual token guidance.

### `ADMIN_DESIGN_TOKENS.md`

Nguồn chuẩn cho admin dashboard tokens. Không copy bừa sang web nếu context khác.

---

## Final Rule

Web token system phải giúp `bigbike-web` nhìn đúng BigBike, bán hàng tốt, SEO tốt, mobile tốt và không bị style drift. Nếu một product card cần developer tự đoán màu giá, spacing ảnh, badge sale và CTA hover, token system đã ngủ quên trên yên xe.
