# ADMIN_DESIGN_TOKENS.md

> Implementation token guideline cho `bigbike-admin`.
>
> File này định nghĩa token-level rules cho giao diện admin BigBike: màu semantic, typography, spacing, density, layout shell, component tokens, table/form tokens, state tokens và responsive mapping.
>
> File này phải bám theo:
> - `docs/brand/BRAND_GUIDELINES.md`
> - `docs/design/DESIGN_SYSTEM.md`
> - `docs/design/ADMIN_DESIGN.md`
>
> File này không định nghĩa business rules, API contract, database schema hoặc page-level UX chi tiết. Token là hệ đo lường và semantic UI, không phải cái thùng rác chứa mọi quyết định còn chưa biết để đâu.

---

## 1. Purpose

`ADMIN_DESIGN_TOKENS.md` là tài liệu chuẩn hóa token cho `bigbike-admin`.

Mục tiêu:

- Giúp admin UI nhất quán về màu, typography, spacing, density, radius, shadow, border và motion.
- Tránh hardcode style rải rác trong component.
- Giúp AI agent và developer biết dùng token nào cho từng context.
- Tách rõ admin token với web token, vì admin cần data density và readability khác public website.
- Giữ BigBike brand identity nhưng không biến dashboard thành landing page.

File này chịu trách nhiệm cho:

- Token naming convention.
- Admin color tokens.
- Semantic state tokens.
- Typography tokens.
- Spacing/density tokens.
- Layout shell tokens.
- Border/radius/shadow tokens.
- Component-level token mapping.
- Table/form/status/modal/toast tokens.
- Responsive token rules.

File này không chịu trách nhiệm cho:

- Business workflow.
- API fields.
- Database schema.
- Full page layout.
- Logo usage chi tiết.
- Source asset inventory.
- Public website tokens.

---

## 2. Token Philosophy

### 2.1 Use semantic tokens first

Component không nên dùng raw color trực tiếp như `#F90606`, `#191919`, `#FFFFFF`.

Ưu tiên:

```text
admin.color.action.primary.background
admin.color.text.primary
admin.color.surface.card
admin.color.status.success.background
admin.spacing.form.fieldGap
admin.radius.control
```

Không ưu tiên:

```text
red
black
white
gray-100
margin-17
buttonColor
```

Raw brand primitives vẫn tồn tại, nhưng component phải dùng semantic token để tránh style drift.

### 2.2 Admin tokens are not web tokens

`bigbike-web` cần brand-heavy, campaign, product storytelling.

`bigbike-admin` cần:

- Dense layout.
- Table readability.
- Form clarity.
- Operational speed.
- Low visual noise.
- Safe destructive actions.

Vì vậy admin token không được copy y nguyên web token nếu làm dashboard quá loãng hoặc quá marketing.

### 2.3 Token hierarchy

Token hierarchy khuyến nghị:

```text
Primitive tokens
  -> Semantic tokens
    -> Component tokens
      -> State/variant tokens
```

Ví dụ:

```text
brand.red.500
  -> admin.color.action.primary.background
    -> admin.button.primary.background.default
      -> admin.button.primary.background.hover
```

### 2.4 No one-off tokens without reason

Không tạo token mới chỉ để sửa một component duy nhất nếu token hiện có đủ dùng.

Chỉ tạo token mới khi:

- Có pattern tái sử dụng.
- Có semantic rõ.
- Có document.
- Có mapping trong design/component system.

Nếu mỗi màn hình có một token riêng, đó không còn là design system nữa, đó là bộ sưu tập hóa thạch CSS.

---

## 3. Token Naming Convention

### 3.1 Prefix

Tất cả admin tokens nên dùng prefix:

```text
admin.
```

Ví dụ:

```text
admin.color.text.primary
admin.spacing.page.paddingX
admin.table.row.height
admin.button.primary.background.default
```

Nếu chuyển sang CSS variables, có thể map:

```css
--admin-color-text-primary
--admin-spacing-page-padding-x
--admin-table-row-height
--admin-button-primary-bg
```

### 3.2 Naming structure

Format khuyến nghị:

```text
admin.{category}.{role}.{property}.{state}
```

Ví dụ:

```text
admin.color.action.primary.background.default
admin.color.action.primary.background.hover
admin.color.action.destructive.background.default
admin.spacing.form.fieldGap
admin.radius.card
admin.shadow.dropdown
admin.table.header.background
```

### 3.3 Category names

Category chính:

```text
admin.color
admin.typography
admin.spacing
admin.layout
admin.radius
admin.border
admin.shadow
admin.motion
admin.zIndex
admin.button
admin.input
admin.select
admin.checkbox
admin.card
admin.table
admin.badge
admin.modal
admin.toast
admin.sidebar
admin.header
admin.form
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
destructive
```

Không dùng state name mơ hồ như:

```text
nice
special
blueMode
newStyle
temporary
```

---

## 4. Brand Primitive Tokens

Brand primitive tokens lấy từ `BRAND_GUIDELINES.md`.

### 4.1 Core brand primitives

| Token | Value | Usage |
|---|---:|---|
| `brand.red.500` | `#F90606` | BigBike primary red |
| `brand.dark.900` | `#191919` | dark gray / brand dark |
| `brand.black` | `#0A0A0A` | deep black |
| `brand.white` | `#FFFFFF` | white |
| `brand.orange.500` | `#F99D1C` | supporting orange |
| `brand.pink.500` | `#E1058C` | supporting pink |
| `brand.blue.500` | `#20C4F4` | supporting blue |
| `brand.green.500` | `#62BB46` | supporting green |

### 4.2 Admin usage rule

Admin không dùng primitives trực tiếp trong component.

Primitive chỉ được dùng để build semantic tokens.

Tốt:

```text
admin.color.action.primary.background = brand.red.500
```

Không tốt:

```tsx
style={{ backgroundColor: '#F90606' }}
```

Chúng ta không cần thêm một hố hardcode để mai sau đào khảo cổ.

---

## 5. Admin Color Tokens

### 5.1 Admin color strategy

Admin color strategy:

- Sidebar/header giữ brand dark.
- Main content ưu tiên readability.
- Red dùng cho primary action, focus, active và critical emphasis.
- Status colors phải có text + color, không dùng màu một mình.
- Destructive action phải phân biệt với primary action dù cùng họ red.
- Surface phải tách rõ với background nhưng không quá tương phản.

### 5.2 Background tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.color.background.app` | `#F5F6F8` | Main app background |
| `admin.color.background.page` | `#F8F9FB` | Page background |
| `admin.color.background.sidebar` | `#0A0A0A` | Sidebar background |
| `admin.color.background.header` | `#FFFFFF` | Top header |
| `admin.color.background.overlay` | `rgba(10,10,10,0.56)` | Modal/drawer overlay |

Rule:

- Main admin content không bắt buộc dark-first.
- Sidebar có thể dark để giữ brand.
- Page background phải giúp table/form đọc dễ.

### 5.3 Surface tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.color.surface.base` | `#FFFFFF` | Card/table/form surface |
| `admin.color.surface.subtle` | `#F3F4F6` | Secondary panels |
| `admin.color.surface.raised` | `#FFFFFF` | Modal/dropdown/raised card |
| `admin.color.surface.hover` | `#F9FAFB` | Row/card hover |
| `admin.color.surface.selected` | `#FFF1F1` | Selected item subtle red |
| `admin.color.surface.disabled` | `#F1F2F4` | Disabled surface |

### 5.4 Text tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.color.text.primary` | `#151515` | Main text |
| `admin.color.text.secondary` | `#4B5563` | Secondary text |
| `admin.color.text.muted` | `#6B7280` | Metadata/help text |
| `admin.color.text.disabled` | `#9CA3AF` | Disabled text |
| `admin.color.text.inverse` | `#FFFFFF` | Text on dark sidebar/red button |
| `admin.color.text.brand` | `#F90606` | Brand emphasis |
| `admin.color.text.danger` | `#B80303` | Danger text |

Rule:

- Không dùng muted text cho data quan trọng.
- Text trên dark sidebar phải đủ contrast.
- Error/danger text phải có message/context.

### 5.5 Border tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.color.border.subtle` | `#E5E7EB` | Card/table subtle border |
| `admin.color.border.default` | `#D1D5DB` | Input/default border |
| `admin.color.border.strong` | `#9CA3AF` | Strong divider |
| `admin.color.border.focus` | `#F90606` | Focus border |
| `admin.color.border.error` | `#D90404` | Error border |
| `admin.color.border.selected` | `#F90606` | Selected border |

### 5.6 Action tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.color.action.primary.background.default` | `#F90606` | Primary action |
| `admin.color.action.primary.background.hover` | `#D90404` | Primary hover |
| `admin.color.action.primary.background.active` | `#B80303` | Primary active |
| `admin.color.action.primary.text` | `#FFFFFF` | Primary text |
| `admin.color.action.secondary.background.default` | `#FFFFFF` | Secondary button |
| `admin.color.action.secondary.background.hover` | `#F9FAFB` | Secondary hover |
| `admin.color.action.secondary.text` | `#151515` | Secondary text |
| `admin.color.action.secondary.border` | `#D1D5DB` | Secondary border |
| `admin.color.action.tertiary.text.default` | `#4B5563` | Tertiary action |
| `admin.color.action.tertiary.text.hover` | `#151515` | Tertiary hover |

### 5.7 Destructive tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.color.action.destructive.background.default` | `#B80303` | Destructive button |
| `admin.color.action.destructive.background.hover` | `#8F0202` | Destructive hover |
| `admin.color.action.destructive.background.soft` | `#FFF1F1` | Danger soft bg |
| `admin.color.action.destructive.text` | `#FFFFFF` | Destructive button text |
| `admin.color.action.destructive.textSoft` | `#B80303` | Inline danger text |
| `admin.color.action.destructive.border` | `#D90404` | Danger border |

Rule:

- Destructive action không được nhầm với primary save/create.
- Confirmation modal phải dùng destructive tokens rõ ràng.

---

## 6. Status Color Tokens

### 6.1 Semantic status mapping

Status phải dùng text + color.

| Semantic | Background | Text | Border | Usage |
|---|---:|---:|---:|---|
| Success | `#ECFDF3` | `#166534` | `#BBF7D0` | completed, active, in stock |
| Warning | `#FFFBEB` | `#92400E` | `#FDE68A` | pending, low stock, needs attention |
| Error | `#FEF2F2` | `#991B1B` | `#FECACA` | failed, invalid, cancelled, error |
| Info | `#EFF6FF` | `#1D4ED8` | `#BFDBFE` | draft, scheduled, informational |
| Neutral | `#F3F4F6` | `#374151` | `#E5E7EB` | archived, disabled, unknown |
| Brand | `#FFF1F1` | `#B80303` | `#FFBCBC` | brand emphasis, selected |

### 6.2 Token names

```text
admin.color.status.success.background
admin.color.status.success.text
admin.color.status.success.border

admin.color.status.warning.background
admin.color.status.warning.text
admin.color.status.warning.border

admin.color.status.error.background
admin.color.status.error.text
admin.color.status.error.border

admin.color.status.info.background
admin.color.status.info.text
admin.color.status.info.border

admin.color.status.neutral.background
admin.color.status.neutral.text
admin.color.status.neutral.border

admin.color.status.brand.background
admin.color.status.brand.text
admin.color.status.brand.border
```

### 6.3 Status usage rules

- Không hardcode status theo module.
- Không dùng color-only status.
- Không dùng cùng một màu cho status có ý nghĩa đối nghịch.
- Không invent business statuses trong token file.
- Status label thật phải lấy từ business/data contract.

---

## 7. Typography Tokens

### 7.1 Font family tokens

| Token | Value | Usage |
|---|---|---|
| `admin.typography.font.body` | `Exo, Inter, Arial, sans-serif` | Default admin font |
| `admin.typography.font.ui` | `Exo, Inter, Arial, sans-serif` | UI controls |
| `admin.typography.font.display` | `Bungee, Exo, Inter, Arial, sans-serif` | Rare brand display |
| `admin.typography.font.mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Code/IDs/logs if needed |

### 7.2 Font size tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.typography.size.xs` | `12px` | caption, table metadata |
| `admin.typography.size.sm` | `14px` | table cell, label, small button |
| `admin.typography.size.md` | `16px` | form input, body |
| `admin.typography.size.lg` | `18px` | section title |
| `admin.typography.size.xl` | `20px` | card title / page subtitle |
| `admin.typography.size.2xl` | `24px` | page title |
| `admin.typography.size.3xl` | `30px` | dashboard hero metric if needed |

Admin không cần headline quá lớn trừ dashboard/login.

### 7.3 Font weight tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.typography.weight.regular` | `400` | body |
| `admin.typography.weight.medium` | `500` | labels, nav |
| `admin.typography.weight.semibold` | `600` | table header, button |
| `admin.typography.weight.bold` | `700` | metric, important title |

### 7.4 Line height tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.typography.lineHeight.tight` | `1.2` | headings |
| `admin.typography.lineHeight.ui` | `1.4` | controls, labels |
| `admin.typography.lineHeight.body` | `1.6` | paragraph/help text |
| `admin.typography.lineHeight.table` | `1.35` | table cells |

### 7.5 Typography roles

| Role | Font | Size | Weight | Line height |
|---|---|---:|---:|---:|
| `pageTitle` | Exo | 24px | 700 | 1.2 |
| `pageDescription` | Exo | 14px | 400 | 1.5 |
| `sectionTitle` | Exo | 18px | 600 | 1.3 |
| `cardTitle` | Exo | 16px | 600 | 1.4 |
| `body` | Exo | 14-16px | 400 | 1.6 |
| `label` | Exo | 14px | 500 | 1.4 |
| `caption` | Exo | 12px | 400 | 1.4 |
| `tableHeader` | Exo | 12-13px | 600 | 1.35 |
| `tableCell` | Exo | 14px | 400 | 1.35 |
| `button` | Exo | 14px | 700 | 1.2 |

---

## 8. Spacing Tokens

### 8.1 Base scale

Admin spacing bám theo 4px scale.

| Token | Value |
|---|---:|
| `admin.spacing.0` | `0` |
| `admin.spacing.1` | `4px` |
| `admin.spacing.2` | `8px` |
| `admin.spacing.3` | `12px` |
| `admin.spacing.4` | `16px` |
| `admin.spacing.5` | `20px` |
| `admin.spacing.6` | `24px` |
| `admin.spacing.8` | `32px` |
| `admin.spacing.10` | `40px` |
| `admin.spacing.12` | `48px` |
| `admin.spacing.16` | `64px` |

Không dùng số lẻ random như `13px`, `27px`, `37px` nếu không có lý do kỹ thuật rõ.

### 8.2 Page spacing

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.spacing.page.paddingX.desktop` | `24px` | Desktop horizontal page padding |
| `admin.spacing.page.paddingY.desktop` | `24px` | Desktop vertical page padding |
| `admin.spacing.page.paddingX.tablet` | `20px` | Tablet horizontal padding |
| `admin.spacing.page.paddingY.tablet` | `20px` | Tablet vertical padding |
| `admin.spacing.page.paddingX.mobile` | `16px` | Small screen horizontal padding |
| `admin.spacing.page.paddingY.mobile` | `16px` | Small screen vertical padding |
| `admin.spacing.page.sectionGap` | `24px` | Gap between page sections |

### 8.3 Form spacing

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.spacing.form.groupGap` | `24px` | Gap between form groups |
| `admin.spacing.form.fieldGap` | `16px` | Gap between fields |
| `admin.spacing.form.labelGap` | `6px` | Label to input gap |
| `admin.spacing.form.helperGap` | `6px` | Input to helper/error gap |
| `admin.spacing.form.actionGap` | `12px` | Button group gap |
| `admin.spacing.form.sectionPadding` | `24px` | Form section/card padding |

### 8.4 Table spacing

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.spacing.table.cellPaddingX` | `12px` | Table cell horizontal padding |
| `admin.spacing.table.cellPaddingY` | `10px` | Table cell vertical padding |
| `admin.spacing.table.headerPaddingY` | `10px` | Header vertical padding |
| `admin.spacing.table.actionGap` | `8px` | Row action gap |
| `admin.spacing.table.toolbarGap` | `12px` | Search/filter toolbar gap |

### 8.5 Card spacing

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.spacing.card.paddingSm` | `16px` | Compact card |
| `admin.spacing.card.paddingMd` | `20px` | Default card |
| `admin.spacing.card.paddingLg` | `24px` | Large card/detail card |
| `admin.spacing.card.headerGap` | `12px` | Header/content gap |
| `admin.spacing.card.contentGap` | `16px` | Internal content gap |

---

## 9. Layout Tokens

### 9.1 Admin shell

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.layout.sidebar.width.expanded` | `264px` | Expanded sidebar |
| `admin.layout.sidebar.width.collapsed` | `72px` | Collapsed sidebar |
| `admin.layout.header.height` | `64px` | Top bar height |
| `admin.layout.content.maxWidth` | `1440px` | Main content max width |
| `admin.layout.content.minWidth` | `320px` | Minimum content width |
| `admin.layout.pageHeader.height.min` | `72px` | Page header minimum height |
| `admin.layout.filterBar.height.min` | `56px` | Filter toolbar minimum height |

### 9.2 Breakpoints

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.breakpoint.sm` | `640px` | Small |
| `admin.breakpoint.md` | `768px` | Tablet |
| `admin.breakpoint.lg` | `1024px` | Desktop |
| `admin.breakpoint.xl` | `1280px` | Large desktop |
| `admin.breakpoint.2xl` | `1536px` | Wide admin screens |

### 9.3 Content width rules

Admin content should:

- Use full available width for tables.
- Constrain forms for readability.
- Avoid ultra-wide form fields.
- Keep detail pages readable with max-width panels.

Suggested:

```text
admin.layout.form.maxWidth = 880px
admin.layout.detail.maxWidth = 1120px
admin.layout.table.minWidth = 960px
```

---

## 10. Radius Tokens

### 10.1 Radius scale

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.radius.none` | `0` | Sharp edge |
| `admin.radius.xs` | `2px` | Tiny controls |
| `admin.radius.sm` | `4px` | Button/input compact |
| `admin.radius.md` | `8px` | Default card/control |
| `admin.radius.lg` | `12px` | Modal/card large |
| `admin.radius.xl` | `16px` | Large panel |
| `admin.radius.full` | `999px` | Pill badge/avatar |

### 10.2 Semantic radius

| Token | Suggested value |
|---|---:|
| `admin.radius.button` | `6px` |
| `admin.radius.input` | `6px` |
| `admin.radius.card` | `10px` |
| `admin.radius.modal` | `14px` |
| `admin.radius.badge` | `999px` |
| `admin.radius.table` | `10px` |
| `admin.radius.dropdown` | `10px` |

Rule:

- Admin radius phải hiện đại nhưng không cute.
- Không dùng bo góc quá lớn cho table/form.

---

## 11. Border Tokens

### 11.1 Border widths

| Token | Suggested value |
|---|---:|
| `admin.border.width.none` | `0` |
| `admin.border.width.sm` | `1px` |
| `admin.border.width.md` | `2px` |

### 11.2 Semantic borders

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.border.default` | `1px solid admin.color.border.default` | Inputs/cards |
| `admin.border.subtle` | `1px solid admin.color.border.subtle` | Table/card dividers |
| `admin.border.focus` | `2px solid admin.color.border.focus` | Focus border |
| `admin.border.error` | `1px solid admin.color.border.error` | Error border |
| `admin.border.selected` | `1px solid admin.color.border.selected` | Selected items |

---

## 12. Shadow / Elevation Tokens

### 12.1 Shadow scale

| Token | Suggested value | Usage |
|---|---|---|
| `admin.shadow.none` | `none` | Flat |
| `admin.shadow.xs` | `0 1px 2px rgba(16, 24, 40, 0.06)` | Tiny lift |
| `admin.shadow.sm` | `0 2px 8px rgba(16, 24, 40, 0.08)` | Card |
| `admin.shadow.md` | `0 8px 24px rgba(16, 24, 40, 0.12)` | Dropdown |
| `admin.shadow.lg` | `0 16px 40px rgba(16, 24, 40, 0.16)` | Modal |
| `admin.shadow.focus` | `0 0 0 3px rgba(249, 6, 6, 0.24)` | Focus ring |

### 12.2 Elevation usage

- Cards: `admin.shadow.xs` hoặc none.
- Dropdown: `admin.shadow.md`.
- Modal: `admin.shadow.lg`.
- Sticky header: subtle shadow only if needed.
- Table rows: no heavy shadow.

Admin không cần shadow như e-commerce card. Đây là nơi đọc dữ liệu, không phải nơi sản phẩm bay lơ lửng.

---

## 13. Motion Tokens

### 13.1 Duration

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.motion.duration.instant` | `80ms` | Very fast feedback |
| `admin.motion.duration.fast` | `140ms` | Hover/press |
| `admin.motion.duration.normal` | `200ms` | Dropdown/modal |
| `admin.motion.duration.slow` | `320ms` | Drawer transition |

### 13.2 Easing

| Token | Suggested value | Usage |
|---|---|---|
| `admin.motion.easing.standard` | `cubic-bezier(0.2, 0, 0, 1)` | Default |
| `admin.motion.easing.exit` | `cubic-bezier(0.4, 0, 1, 1)` | Exit |
| `admin.motion.easing.emphasized` | `cubic-bezier(0.2, 0, 0, 1.1)` | Rare emphasis |

### 13.3 Motion rules

- Admin motion must be fast and subtle.
- No bouncy/cute animation.
- Use motion for hover, dropdown, modal, drawer, toast.
- Respect `prefers-reduced-motion`.

---

## 14. Z-index Tokens

| Token | Suggested value | Usage |
|---|---:|---|
| `admin.zIndex.base` | `0` | Base |
| `admin.zIndex.raised` | `10` | Raised card |
| `admin.zIndex.sticky` | `100` | Sticky toolbar/header |
| `admin.zIndex.sidebar` | `200` | Sidebar |
| `admin.zIndex.header` | `300` | Top header |
| `admin.zIndex.dropdown` | `400` | Dropdown/menu |
| `admin.zIndex.drawer` | `500` | Drawer |
| `admin.zIndex.overlay` | `600` | Overlay |
| `admin.zIndex.modal` | `700` | Modal |
| `admin.zIndex.toast` | `800` | Toast |

Rule:

- Không dùng z-index random như `999999`.
- Nếu cần cao hơn modal, document lý do.

---

## 15. Button Tokens

### 15.1 Button sizing

| Token | Suggested value |
|---|---:|
| `admin.button.height.sm` | `32px` |
| `admin.button.height.md` | `40px` |
| `admin.button.height.lg` | `48px` |
| `admin.button.paddingX.sm` | `12px` |
| `admin.button.paddingX.md` | `16px` |
| `admin.button.paddingX.lg` | `20px` |
| `admin.button.gap` | `8px` |
| `admin.button.radius` | `admin.radius.button` |

### 15.2 Primary button

| Token | Value |
|---|---|
| `admin.button.primary.background.default` | `admin.color.action.primary.background.default` |
| `admin.button.primary.background.hover` | `admin.color.action.primary.background.hover` |
| `admin.button.primary.background.active` | `admin.color.action.primary.background.active` |
| `admin.button.primary.text` | `admin.color.action.primary.text` |
| `admin.button.primary.border` | `transparent` |

### 15.3 Secondary button

| Token | Value |
|---|---|
| `admin.button.secondary.background.default` | `admin.color.action.secondary.background.default` |
| `admin.button.secondary.background.hover` | `admin.color.action.secondary.background.hover` |
| `admin.button.secondary.text` | `admin.color.action.secondary.text` |
| `admin.button.secondary.border` | `admin.color.action.secondary.border` |

### 15.4 Tertiary button

| Token | Value |
|---|---|
| `admin.button.tertiary.background.default` | `transparent` |
| `admin.button.tertiary.background.hover` | `admin.color.surface.hover` |
| `admin.button.tertiary.text.default` | `admin.color.action.tertiary.text.default` |
| `admin.button.tertiary.text.hover` | `admin.color.action.tertiary.text.hover` |

### 15.5 Destructive button

| Token | Value |
|---|---|
| `admin.button.destructive.background.default` | `admin.color.action.destructive.background.default` |
| `admin.button.destructive.background.hover` | `admin.color.action.destructive.background.hover` |
| `admin.button.destructive.text` | `admin.color.action.destructive.text` |
| `admin.button.destructive.border` | `transparent` |

### 15.6 Disabled/loading

| Token | Suggested value |
|---|---|
| `admin.button.disabled.background` | `admin.color.surface.disabled` |
| `admin.button.disabled.text` | `admin.color.text.disabled` |
| `admin.button.disabled.border` | `admin.color.border.subtle` |
| `admin.button.loading.opacity` | `0.72` |

Rules:

- Loading button blocks double-submit.
- Disabled button must look non-interactive.
- Destructive disabled state must not look active.

---

## 16. Input & Form Tokens

### 16.1 Input sizing

| Token | Suggested value |
|---|---:|
| `admin.input.height.sm` | `32px` |
| `admin.input.height.md` | `40px` |
| `admin.input.height.lg` | `48px` |
| `admin.input.paddingX` | `12px` |
| `admin.input.radius` | `admin.radius.input` |
| `admin.input.fontSize` | `admin.typography.size.sm` |

### 16.2 Input colors

| Token | Value |
|---|---|
| `admin.input.background.default` | `admin.color.surface.base` |
| `admin.input.background.disabled` | `admin.color.surface.disabled` |
| `admin.input.text.default` | `admin.color.text.primary` |
| `admin.input.text.placeholder` | `admin.color.text.muted` |
| `admin.input.border.default` | `admin.color.border.default` |
| `admin.input.border.hover` | `admin.color.border.strong` |
| `admin.input.border.focus` | `admin.color.border.focus` |
| `admin.input.border.error` | `admin.color.border.error` |
| `admin.input.shadow.focus` | `admin.shadow.focus` |

### 16.3 Label tokens

| Token | Suggested value |
|---|---|
| `admin.form.label.color` | `admin.color.text.primary` |
| `admin.form.label.fontSize` | `admin.typography.size.sm` |
| `admin.form.label.fontWeight` | `admin.typography.weight.medium` |
| `admin.form.required.color` | `admin.color.text.danger` |

### 16.4 Helper/error tokens

| Token | Suggested value |
|---|---|
| `admin.form.helper.color` | `admin.color.text.muted` |
| `admin.form.helper.fontSize` | `admin.typography.size.xs` |
| `admin.form.error.color` | `admin.color.text.danger` |
| `admin.form.error.fontSize` | `admin.typography.size.xs` |

---

## 17. Select, Checkbox, Radio Tokens

### 17.1 Select

Select should reuse input tokens.

Additional:

| Token | Suggested value |
|---|---|
| `admin.select.menu.background` | `admin.color.surface.raised` |
| `admin.select.menu.border` | `admin.color.border.subtle` |
| `admin.select.menu.shadow` | `admin.shadow.md` |
| `admin.select.option.background.hover` | `admin.color.surface.hover` |
| `admin.select.option.background.selected` | `admin.color.surface.selected` |
| `admin.select.option.text.selected` | `admin.color.text.brand` |

### 17.2 Checkbox

| Token | Suggested value |
|---|---|
| `admin.checkbox.size` | `16px` |
| `admin.checkbox.radius` | `4px` |
| `admin.checkbox.border.default` | `admin.color.border.default` |
| `admin.checkbox.border.checked` | `admin.color.action.primary.background.default` |
| `admin.checkbox.background.checked` | `admin.color.action.primary.background.default` |
| `admin.checkbox.icon.color` | `admin.color.text.inverse` |

### 17.3 Radio

| Token | Suggested value |
|---|---|
| `admin.radio.size` | `16px` |
| `admin.radio.border.default` | `admin.color.border.default` |
| `admin.radio.border.checked` | `admin.color.action.primary.background.default` |
| `admin.radio.dot.color` | `admin.color.action.primary.background.default` |

---

## 18. Card Tokens

### 18.1 Card base

| Token | Suggested value |
|---|---|
| `admin.card.background` | `admin.color.surface.base` |
| `admin.card.border` | `admin.color.border.subtle` |
| `admin.card.radius` | `admin.radius.card` |
| `admin.card.shadow` | `admin.shadow.xs` |
| `admin.card.padding.sm` | `admin.spacing.card.paddingSm` |
| `admin.card.padding.md` | `admin.spacing.card.paddingMd` |
| `admin.card.padding.lg` | `admin.spacing.card.paddingLg` |

### 18.2 Metric card

| Token | Suggested value |
|---|---|
| `admin.metricCard.background` | `admin.color.surface.base` |
| `admin.metricCard.label.color` | `admin.color.text.secondary` |
| `admin.metricCard.value.color` | `admin.color.text.primary` |
| `admin.metricCard.delta.positive.color` | `admin.color.status.success.text` |
| `admin.metricCard.delta.negative.color` | `admin.color.status.error.text` |
| `admin.metricCard.delta.neutral.color` | `admin.color.text.muted` |

---

## 19. Table Tokens

### 19.1 Table base

| Token | Suggested value |
|---|---|
| `admin.table.background` | `admin.color.surface.base` |
| `admin.table.border` | `admin.color.border.subtle` |
| `admin.table.radius` | `admin.radius.table` |
| `admin.table.shadow` | `admin.shadow.xs` |

### 19.2 Table header

| Token | Suggested value |
|---|---|
| `admin.table.header.background` | `#F9FAFB` |
| `admin.table.header.text` | `admin.color.text.secondary` |
| `admin.table.header.fontSize` | `admin.typography.size.xs` |
| `admin.table.header.fontWeight` | `admin.typography.weight.semibold` |
| `admin.table.header.height` | `44px` |
| `admin.table.header.borderBottom` | `admin.color.border.subtle` |

### 19.3 Table row

| Token | Suggested value |
|---|---|
| `admin.table.row.background.default` | `admin.color.surface.base` |
| `admin.table.row.background.hover` | `admin.color.surface.hover` |
| `admin.table.row.background.selected` | `admin.color.surface.selected` |
| `admin.table.row.height.compact` | `44px` |
| `admin.table.row.height.default` | `52px` |
| `admin.table.row.height.comfortable` | `60px` |
| `admin.table.row.borderBottom` | `admin.color.border.subtle` |

### 19.4 Table cell

| Token | Suggested value |
|---|---|
| `admin.table.cell.paddingX` | `admin.spacing.table.cellPaddingX` |
| `admin.table.cell.paddingY` | `admin.spacing.table.cellPaddingY` |
| `admin.table.cell.text` | `admin.color.text.primary` |
| `admin.table.cell.fontSize` | `admin.typography.size.sm` |
| `admin.table.cell.lineHeight` | `admin.typography.lineHeight.table` |
| `admin.table.cell.mutedText` | `admin.color.text.muted` |

### 19.5 Table toolbar

| Token | Suggested value |
|---|---|
| `admin.table.toolbar.background` | `admin.color.surface.base` |
| `admin.table.toolbar.padding` | `admin.spacing.4` |
| `admin.table.toolbar.gap` | `admin.spacing.table.toolbarGap` |
| `admin.table.toolbar.borderBottom` | `admin.color.border.subtle` |

---

## 20. Badge Tokens

### 20.1 Badge size

| Token | Suggested value |
|---|---:|
| `admin.badge.height.sm` | `22px` |
| `admin.badge.height.md` | `26px` |
| `admin.badge.paddingX.sm` | `8px` |
| `admin.badge.paddingX.md` | `10px` |
| `admin.badge.radius` | `admin.radius.badge` |
| `admin.badge.fontSize` | `admin.typography.size.xs` |
| `admin.badge.fontWeight` | `admin.typography.weight.semibold` |

### 20.2 Badge variants

```text
admin.badge.success.background = admin.color.status.success.background
admin.badge.success.text = admin.color.status.success.text
admin.badge.success.border = admin.color.status.success.border

admin.badge.warning.background = admin.color.status.warning.background
admin.badge.warning.text = admin.color.status.warning.text
admin.badge.warning.border = admin.color.status.warning.border

admin.badge.error.background = admin.color.status.error.background
admin.badge.error.text = admin.color.status.error.text
admin.badge.error.border = admin.color.status.error.border

admin.badge.info.background = admin.color.status.info.background
admin.badge.info.text = admin.color.status.info.text
admin.badge.info.border = admin.color.status.info.border

admin.badge.neutral.background = admin.color.status.neutral.background
admin.badge.neutral.text = admin.color.status.neutral.text
admin.badge.neutral.border = admin.color.status.neutral.border

admin.badge.brand.background = admin.color.status.brand.background
admin.badge.brand.text = admin.color.status.brand.text
admin.badge.brand.border = admin.color.status.brand.border
```

---

## 21. Sidebar Tokens

### 21.1 Sidebar base

| Token | Suggested value |
|---|---|
| `admin.sidebar.background` | `admin.color.background.sidebar` |
| `admin.sidebar.text.default` | `rgba(255,255,255,0.72)` |
| `admin.sidebar.text.active` | `#FFFFFF` |
| `admin.sidebar.text.muted` | `rgba(255,255,255,0.48)` |
| `admin.sidebar.border` | `rgba(255,255,255,0.10)` |
| `admin.sidebar.width.expanded` | `admin.layout.sidebar.width.expanded` |
| `admin.sidebar.width.collapsed` | `admin.layout.sidebar.width.collapsed` |

### 21.2 Sidebar item

| Token | Suggested value |
|---|---|
| `admin.sidebar.item.height` | `40px` |
| `admin.sidebar.item.paddingX` | `12px` |
| `admin.sidebar.item.radius` | `8px` |
| `admin.sidebar.item.background.default` | `transparent` |
| `admin.sidebar.item.background.hover` | `rgba(255,255,255,0.08)` |
| `admin.sidebar.item.background.active` | `rgba(249,6,6,0.18)` |
| `admin.sidebar.item.border.active` | `#F90606` |
| `admin.sidebar.item.icon.color.default` | `rgba(255,255,255,0.64)` |
| `admin.sidebar.item.icon.color.active` | `#FFFFFF` |

### 21.3 Sidebar logo area

| Token | Suggested value |
|---|---|
| `admin.sidebar.logo.height` | `64px` |
| `admin.sidebar.logo.paddingX` | `16px` |
| `admin.sidebar.logo.borderBottom` | `rgba(255,255,255,0.10)` |

---

## 22. Header Tokens

| Token | Suggested value |
|---|---|
| `admin.header.height` | `admin.layout.header.height` |
| `admin.header.background` | `admin.color.background.header` |
| `admin.header.borderBottom` | `admin.color.border.subtle` |
| `admin.header.shadow` | `admin.shadow.none` |
| `admin.header.paddingX` | `24px` |
| `admin.header.actionGap` | `12px` |
| `admin.header.search.width` | `360px` |

Rule:

- Header không được quá cao.
- Header action không được lấn page action.
- Global search nếu có phải rõ purpose.

---

## 23. Modal / Drawer Tokens

### 23.1 Modal

| Token | Suggested value |
|---|---|
| `admin.modal.overlay.background` | `admin.color.background.overlay` |
| `admin.modal.background` | `admin.color.surface.raised` |
| `admin.modal.radius` | `admin.radius.modal` |
| `admin.modal.shadow` | `admin.shadow.lg` |
| `admin.modal.width.sm` | `420px` |
| `admin.modal.width.md` | `560px` |
| `admin.modal.width.lg` | `720px` |
| `admin.modal.padding` | `24px` |
| `admin.modal.headerGap` | `12px` |
| `admin.modal.footerGap` | `12px` |

### 23.2 Drawer

| Token | Suggested value |
|---|---|
| `admin.drawer.background` | `admin.color.surface.raised` |
| `admin.drawer.width.sm` | `360px` |
| `admin.drawer.width.md` | `480px` |
| `admin.drawer.width.lg` | `640px` |
| `admin.drawer.shadow` | `admin.shadow.lg` |
| `admin.drawer.padding` | `24px` |

---

## 24. Toast / Alert Tokens

### 24.1 Toast

| Token | Suggested value |
|---|---|
| `admin.toast.background` | `admin.color.surface.raised` |
| `admin.toast.text` | `admin.color.text.primary` |
| `admin.toast.border` | `admin.color.border.subtle` |
| `admin.toast.radius` | `admin.radius.card` |
| `admin.toast.shadow` | `admin.shadow.md` |
| `admin.toast.paddingX` | `16px` |
| `admin.toast.paddingY` | `12px` |
| `admin.toast.maxWidth` | `420px` |

### 24.2 Alert variants

Alert variants reuse status tokens:

```text
admin.alert.success.background = admin.color.status.success.background
admin.alert.warning.background = admin.color.status.warning.background
admin.alert.error.background = admin.color.status.error.background
admin.alert.info.background = admin.color.status.info.background
```

Rule:

- Toast for short feedback.
- Inline alert for persistent section/page issues.
- Error alert must include next action if possible.

---

## 25. Empty / Loading / Error Tokens

### 25.1 Empty state

| Token | Suggested value |
|---|---|
| `admin.emptyState.paddingY` | `48px` |
| `admin.emptyState.icon.size` | `48px` |
| `admin.emptyState.icon.color` | `admin.color.text.muted` |
| `admin.emptyState.title.color` | `admin.color.text.primary` |
| `admin.emptyState.description.color` | `admin.color.text.secondary` |
| `admin.emptyState.actionGap` | `12px` |

### 25.2 Skeleton

| Token | Suggested value |
|---|---|
| `admin.skeleton.background` | `#E5E7EB` |
| `admin.skeleton.highlight` | `#F3F4F6` |
| `admin.skeleton.radius` | `admin.radius.sm` |
| `admin.skeleton.animation.duration` | `1200ms` |

### 25.3 Error state

| Token | Suggested value |
|---|---|
| `admin.errorState.background` | `admin.color.status.error.background` |
| `admin.errorState.text` | `admin.color.status.error.text` |
| `admin.errorState.border` | `admin.color.status.error.border` |
| `admin.errorState.icon.color` | `admin.color.status.error.text` |

---

## 26. Pagination Tokens

| Token | Suggested value |
|---|---|
| `admin.pagination.height` | `40px` |
| `admin.pagination.item.size` | `36px` |
| `admin.pagination.item.radius` | `admin.radius.button` |
| `admin.pagination.item.background.default` | `admin.color.surface.base` |
| `admin.pagination.item.background.hover` | `admin.color.surface.hover` |
| `admin.pagination.item.background.active` | `admin.color.action.primary.background.default` |
| `admin.pagination.item.text.default` | `admin.color.text.secondary` |
| `admin.pagination.item.text.active` | `admin.color.text.inverse` |
| `admin.pagination.border` | `admin.color.border.default` |

---

## 27. Avatar / Media Tokens

### 27.1 Avatar

| Token | Suggested value |
|---|---|
| `admin.avatar.size.sm` | `24px` |
| `admin.avatar.size.md` | `32px` |
| `admin.avatar.size.lg` | `40px` |
| `admin.avatar.radius` | `admin.radius.full` |
| `admin.avatar.background` | `admin.color.surface.subtle` |
| `admin.avatar.text` | `admin.color.text.secondary` |

### 27.2 Product thumbnail

| Token | Suggested value |
|---|---|
| `admin.productThumbnail.size.sm` | `40px` |
| `admin.productThumbnail.size.md` | `56px` |
| `admin.productThumbnail.size.lg` | `72px` |
| `admin.productThumbnail.radius` | `admin.radius.sm` |
| `admin.productThumbnail.background` | `admin.color.surface.subtle` |
| `admin.productThumbnail.border` | `admin.color.border.subtle` |

Rule:

- Product thumbnails in table must not make rows absurdly tall.
- Use fallback image/icon when missing.

---

## 28. CSS Variable Mapping Example

Nếu implement bằng CSS variables, mapping có thể như sau:

```css
:root {
  --admin-color-brand-red: #F90606;
  --admin-color-background-app: #F5F6F8;
  --admin-color-background-page: #F8F9FB;
  --admin-color-background-sidebar: #0A0A0A;

  --admin-color-surface-base: #FFFFFF;
  --admin-color-surface-subtle: #F3F4F6;
  --admin-color-surface-hover: #F9FAFB;
  --admin-color-surface-selected: #FFF1F1;

  --admin-color-text-primary: #151515;
  --admin-color-text-secondary: #4B5563;
  --admin-color-text-muted: #6B7280;
  --admin-color-text-disabled: #9CA3AF;
  --admin-color-text-inverse: #FFFFFF;
  --admin-color-text-brand: #F90606;

  --admin-color-border-subtle: #E5E7EB;
  --admin-color-border-default: #D1D5DB;
  --admin-color-border-focus: #F90606;
  --admin-color-border-error: #D90404;

  --admin-font-body: "Exo", "Inter", Arial, sans-serif;
  --admin-font-display: "Bungee", "Exo", "Inter", Arial, sans-serif;

  --admin-radius-button: 6px;
  --admin-radius-input: 6px;
  --admin-radius-card: 10px;
  --admin-radius-modal: 14px;

  --admin-sidebar-width-expanded: 264px;
  --admin-sidebar-width-collapsed: 72px;
  --admin-header-height: 64px;
}
```

Đây là ví dụ mapping, không phải bắt buộc copy 1:1 nếu stack dùng Tailwind/theme object/design token pipeline.

---

## 29. TypeScript Token Mapping Example

Nếu implement bằng TypeScript object:

```ts
export const adminTokens = {
  color: {
    brand: {
      red: "#F90606",
    },
    background: {
      app: "#F5F6F8",
      page: "#F8F9FB",
      sidebar: "#0A0A0A",
    },
    text: {
      primary: "#151515",
      secondary: "#4B5563",
      muted: "#6B7280",
      inverse: "#FFFFFF",
      brand: "#F90606",
    },
  },
  radius: {
    button: 6,
    input: 6,
    card: 10,
    modal: 14,
  },
  layout: {
    sidebarExpanded: 264,
    sidebarCollapsed: 72,
    headerHeight: 64,
  },
} as const;
```

Rule:

- Token object phải read-only.
- Component không tự tạo value ngoài token nếu không có lý do.
- Nếu dùng Tailwind, map token vào theme.

---

## 30. Tailwind Mapping Guidance

Nếu `bigbike-admin` dùng Tailwind, nên map token vào `theme.extend`.

Example naming:

```text
colors.admin.bg
colors.admin.surface
colors.admin.text.primary
colors.admin.text.secondary
colors.admin.brand
colors.admin.border
colors.admin.status.success.bg
colors.admin.status.success.text
```

Không dùng arbitrary values tràn lan:

```tsx
className="bg-[#F90606] text-[#FFFFFF] px-[17px]"
```

Chỉ dùng arbitrary value khi:

- Đó là case kỹ thuật rất hẹp.
- Có comment/lý do.
- Không nên thành pattern lặp lại.

---

## 31. Token Usage Rules for AI Agents

AI agent khi sửa `bigbike-admin` phải:

1. Đọc `BRAND_GUIDELINES.md`.
2. Đọc `DESIGN_SYSTEM.md`.
3. Đọc `ADMIN_DESIGN.md`.
4. Đọc `ADMIN_DESIGN_TOKENS.md`.
5. Dùng semantic tokens trước primitive tokens.
6. Không hardcode màu, spacing, font, radius nếu token đã có.
7. Không copy web token sang admin nếu làm admin quá loãng/marketing.
8. Không tạo token mới nếu không có semantic rõ.
9. Không dùng red cho mọi thứ.
10. Không tạo status color không có text label.
11. Không dùng z-index random.
12. Không dùng Bungee trong table/form/sidebar nav phổ thông.
13. Không tạo one-off component style nếu component hiện có đáp ứng.
14. Không bỏ qua focus, disabled, loading, error states.

---

## 32. Token Review Checklist

Trước khi merge UI hoặc token changes:

### General

- [ ] Token dùng semantic name.
- [ ] Không hardcode raw color trong component.
- [ ] Không tạo token mới thiếu lý do.
- [ ] Token không trùng nghĩa với token đã có.
- [ ] Token không lệch brand direction.

### Color

- [ ] Primary action dùng BigBike Red có kiểm soát.
- [ ] Destructive action phân biệt rõ.
- [ ] Status có text + color.
- [ ] Contrast đủ đọc.
- [ ] Sidebar/header giữ brand nhưng không làm content khó đọc.

### Typography

- [ ] Admin UI dùng Exo.
- [ ] Bungee không dùng cho table/form/body dài.
- [ ] Font size đủ đọc.
- [ ] Line-height phù hợp tiếng Việt.

### Spacing / layout

- [ ] Spacing theo 4px scale.
- [ ] Admin density compact nhưng readable.
- [ ] Sidebar/header/table/form tokens nhất quán.
- [ ] No random one-off spacing.

### Components

- [ ] Button có hover/focus/disabled/loading.
- [ ] Input có focus/error/disabled.
- [ ] Table có loading/empty/error.
- [ ] Badge/status dùng semantic tokens.
- [ ] Modal/drawer có overlay/z-index đúng.

### Accessibility

- [ ] Focus ring visible.
- [ ] Disabled state rõ.
- [ ] Color không phải tín hiệu duy nhất.
- [ ] Contrast đạt mức đọc được.
- [ ] Touch/click target đủ lớn.

---

## 33. Relationship With Other Docs

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

### `ADMIN_DESIGN.md`

Nguồn chuẩn cho:

- Admin UX.
- Admin layout.
- CRUD/table/form behavior.
- Admin-specific screen rules.

### `ADMIN_DESIGN_TOKENS.md`

Nguồn chuẩn cho:

- Admin token semantics.
- Admin implementation values.
- Admin component token mapping.
- Admin density and state tokens.

### `WEB_DESIGN_TOKENS.md`

Nguồn chuẩn cho public website tokens. Không copy bừa sang admin nếu context khác.

---

## Final Rule

Admin token system phải giúp `bigbike-admin` nhất quán, nhanh, dễ đọc và an toàn khi thao tác. Nếu developer phải đoán nên dùng màu nào cho nút `Save`, token system đã thất bại. Nếu mỗi component tự chọn màu riêng, xin chúc mừng, bạn vừa xây một bãi giữ xe CSS có thu phí bằng bug.
