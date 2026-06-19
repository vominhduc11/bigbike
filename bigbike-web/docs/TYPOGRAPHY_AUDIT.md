# TYPOGRAPHY AUDIT — bigbike-web

> Audit cơ học cỡ chữ (font-size) so với hệ thống token typography.
> Nguồn token: `styles/brand-tokens.css` (`--fs-*`, `--bb-text-*`) + `app/globals.css` `@theme` (`--text-ui-*`, các utility `text-h1..h4`, `text-display`, `text-body`, `text-caption`, `text-overline`, `text-ui-*`, `text-13/15/17/...`).

**Token hợp lệ** (prefix biến CSS): `--fs-*`, `--bb-text-*`, `--text-ui-*`. Utility Tailwind hợp lệ map từ các token này (KHÔNG phải scale built-in).

> **Trạng thái khắc phục (2026-06-19):** Đã đồng bộ cỡ chữ cho toàn bộ component React/shadcn **không-WP** — mọi `text-xs/sm/base/lg/xl/2xl/3xl/5xl` built-in (mục [A]) và `text-[11px]` (mục arbitrary) trong phạm vi này đã đổi sang token utility theo vai trò (`text-overline/caption/body/button/h4/h3/h2/h1/display`, control→`text-ui-*`); cùng-px ở hầu hết chỗ, có vài chỗ chỉnh px cho khớp vai trò (bảng thông số 18→16, số nổi bật bỏ bậc responsive, điểm đánh giá 48→40). **Giữ nguyên có chủ đích (WP-parity):** `components/wp/*` (WpAuthField/WpCheckoutClient/WpFooter/WpLangSwitch/WpProductTabs/WpPurchaseSection), `ProductCard`, `app/lien-he`, `app/brands/WpBrandListClient`, `app/bao-hanh/WarrantyContent`, `app/don-hang/xac-nhan`; cùng `lib/cart-context` + `lib/ui-classes` đã đổi. Quy tắc chống tái diễn: xem `STYLEGUIDE.md` §Typography → "Quy tắc đồng bộ cỡ chữ". Bảng chi tiết bên dưới là ảnh chụp TRƯỚC khắc phục.

## Phạm vi quét

- **Đã quét** (mã nguồn do dự án viết): `app/`, `components/`, `lib/`, `i18n/`, `content/`, `messages/`, `scripts/`, `e2e/`, `__tests__/`, `styles/`.
- **Bỏ qua**: `node_modules/`, `.next/`, `dist/`, `output/`, `*.min.*`, `styles/brand-tokens.css`, `app/globals.css` (file định nghĩa token — theo đề bài).
- **Bỏ qua `public/wp-content/`**: toàn bộ CSS theme WordPress + plugin (WooCommerce, perfect-woocommerce-brands…) là asset legacy/vendor được phục vụ tĩnh để giữ giao diện WP gốc — KHÔNG thuộc hệ token, không sửa. Các file này chứa hàng trăm `font-size: Npx` nhưng nằm ngoài phạm vi hệ thống thiết kế.
- Lưu ý: dự án KHÔNG có thư mục `src/`; mã nguồn nằm trực tiếp ở các thư mục trên (Next.js app router).

---

## Phần 1 — Summary

- File quét (code + css trong phạm vi): **358**
- File có vi phạm: **67**
- Tổng **errors** (A + B + C): **242**  (A=240, B=2, C=0)
- Tổng **warnings** (D): **0**

---

## Phần 2 — Violations by Type

| Loại | Mô tả | Số lượng |
|---|---|---|
| **[A] TAILWIND_BUILTIN** | class `text-xs … text-9xl` (scale built-in) trong JSX/TSX/JS/TS | 240 |
| **[B] INLINE_FONT_SIZE** | `fontSize:` trong object style | 2 |
| **[C] CSS_HARDCODE** | `font-size: <số>` không qua var() (CSS trong phạm vi) | 0 |
| **[D] INVALID_CSS_VAR** | `font-size: var(--x)` với biến không thuộc `--fs-/--bb-text-/--text-ui-` | 0 |

### [A] Phân rã theo class

| Class built-in | Số lần | Gợi ý token |
|---|---|---|
| `text-xs` | 26 | text-overline (--fs-overline: 12px) |
| `text-sm` | 160 | text-caption (--fs-caption: 14px) |
| `text-base` | 23 | text-body (--fs-body: 16px) |
| `text-lg` | 21 | text-h4 (--fs-h4: 18px) |
| `text-xl` | 1 | text-h3 (--fs-h3: 20px) |
| `text-2xl` | 5 | text-h2 (22px) hoặc text-h1 (24px) |
| `text-3xl` | 3 | text-h1 (24px) hoặc text-display (40px) |
| `text-5xl` | 1 | text-h1 (24px) hoặc text-display (40px) |

---

## Phần 3 — Detail by File

### `app/bao-hanh/WarrantyContent.tsx`  (8)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 95 | A | text-sm | `<span className="text-sm tracking-display uppercase text-brand font-bold block mb-2">{copy.kicker}</span>` | text-sm → text-caption (--fs-caption: 14px) |
| 151 | A | text-sm | `<div className="bg-[var(--bb-state-danger-bg)] border border-[var(--bb-state-danger-border)] p-[14px_18px] text-sm text-destructive mt-4">` | text-sm → text-caption (--fs-caption: 14px) |
| 166 | A | text-sm | `<td className="text-muted-foreground text-sm w-[40%] py-1.5">{copy.fieldProduct}</td>` | text-sm → text-caption (--fs-caption: 14px) |
| 170 | A | text-sm | `<td className="text-muted-foreground text-sm py-1.5">{copy.fieldSerial}</td>` | text-sm → text-caption (--fs-caption: 14px) |
| 174 | A | text-sm | `<td className="text-muted-foreground text-sm py-1.5">{copy.fieldStart}</td>` | text-sm → text-caption (--fs-caption: 14px) |
| 178 | A | text-sm | `<td className="text-muted-foreground text-sm py-1.5">{copy.fieldEnd}</td>` | text-sm → text-caption (--fs-caption: 14px) |
| 185 | A | text-sm | `<p className="text-muted-foreground text-sm mt-3 m-0">` | text-sm → text-caption (--fs-caption: 14px) |
| 190 | A | text-sm | `<p className="mt-3 text-sm text-destructive m-0">` | text-sm → text-caption (--fs-caption: 14px) |

### `app/brands/WpBrandListClient.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 116 | A | text-2xl | `<span className="text-2xl font-bold tracking-wide text-neutral-300">{initials}</span>` | text-2xl → text-h2 (22px) hoặc text-h1 (24px) |
| 119 | A | text-sm | `<span className="text-center text-sm font-semibold uppercase tracking-wide text-neutral-800">` | text-sm → text-caption (--fs-caption: 14px) |

### `app/don-hang/xac-nhan/page.tsx`  (5)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 140 | A | text-sm | `<p className="m-0 text-sm uppercase leading-6 text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 144 | A | text-sm | `<p className="mx-auto mt-3 max-w-[420px] text-sm leading-6 text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 178 | A | text-sm | `<ul className="woocommerce-order-overview woocommerce-thankyou-order-details order_details m-0 flex list-none flex-wrap gap-y-4 border-0 p-0 text-sm text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 216 | A | text-sm | `<table className="woocommerce-table woocommerce-table--order-details shop_table order_details w-full border-collapse border border-border text-left text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 285 | A | text-sm | `<div className="border border-border p-4 text-sm leading-7 text-foreground">` | text-sm → text-caption (--fs-caption: 14px) |

### `app/error.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 33 | A | text-sm | `<p className="m-0 text-sm text-muted-foreground">{t("description")}</p>` | text-sm → text-caption (--fs-caption: 14px) |

### `app/huong-dan/GuidePage.tsx`  (3)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 109 | A | text-sm | `<p className="text-sm text-neutral-500">{t("emptyMenu")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 119 | A | text-lg | `<h2 className="m-0 mb-2 text-lg font-semibold uppercase tracking-wide text-neutral-900">` | text-lg → text-h4 (--fs-h4: 18px) |
| 123 | A | text-sm | `<p className="m-0 text-sm leading-relaxed text-neutral-500">{entry.description}</p>` | text-sm → text-caption (--fs-caption: 14px) |

### `app/lien-he/page.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 110 | B | fontSize: 24px | `<h1 style={{ fontSize: "24px" }}><LText field="title">{pageTitle}</LText></h1>` | var(--fs-h1) hoặc class text-h1 |

### `app/not-found.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 62 | A | text-sm | `className="flex-1 border-0 rounded-none bg-transparent h-12 min-h-0 text-sm focus-visible:ring-0 focus-visible:ring-offset-0"` | text-sm → text-caption (--fs-caption: 14px) |

### `app/tai-khoan/DashboardContent.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 36 | A | text-sm | `<p className="m-0 text-sm font-semibold text-foreground">{t("emailNotVerified")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 48 | A | text-sm | `<span className="text-sm text-[var(--bb-danger)]">{t("emailVerifyError")}</span>` | text-sm → text-caption (--fs-caption: 14px) |

### `app/tai-khoan/doi-tra/ReturnsContent.tsx`  (17)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 87 | A | text-sm | `{error && <p className="text-brand text-sm m-0 p-6">{error}</p>}` | text-sm → text-caption (--fs-caption: 14px) |
| 104 | A | text-sm | `<div key={i} className="flex justify-between items-center text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 113 | A | text-sm | `<div className="py-3 px-[14px] text-sm leading-body bg-[var(--bb-bg-surface-raised)] text-muted-foreground [&_p]:m-0">` | text-sm → text-caption (--fs-caption: 14px) |
| 114 | A | text-sm | `<p className="text-sm font-bold tracking-display uppercase mb-[6px]">{t("customerNoteHeading")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 121 | A | text-sm | `<div className="py-3 px-[14px] text-sm leading-body bg-[var(--bb-state-warning-bg)] text-state-warning-text border border-[var(--bb-state-warning-border)] [&_p]:m-0">` | text-sm → text-caption (--fs-caption: 14px) |
| 122 | A | text-sm | `<p className="text-sm font-bold tracking-display uppercase mb-[6px]">{t("adminNoteHeading")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 131 | A | text-sm | `<table className="w-full border-collapse text-sm text-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 144 | A | text-sm | `{item.variantName && <span className="text-muted-foreground text-sm block">{item.variantName}</span>}` | text-sm → text-caption (--fs-caption: 14px) |
| 164 | A | text-sm | `<p className="text-sm font-semibold text-foreground m-0 mb-[3px]">` | text-sm → text-caption (--fs-caption: 14px) |
| 168 | A | text-sm | `<p className="text-sm text-muted-foreground m-0 mb-[3px]"><LocalDate value={h.createdAt} dateStyle="slashPad" fallback="—" /></p>` | text-sm → text-caption (--fs-caption: 14px) |
| 169 | A | text-sm | `{h.note && <p className="text-sm text-muted-foreground m-0 italic">{h.note}</p>}` | text-sm → text-caption (--fs-caption: 14px) |
| 326 | A | text-sm | `<p className="text-sm text-muted-foreground m-0">{t("subtitle")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 338 | A | text-sm | `{error && <p className="text-brand text-sm mb-4 m-0">{error}</p>}` | text-sm → text-caption (--fs-caption: 14px) |
| 354 | A | text-sm | `<p className="text-sm text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 378 | A | text-sm | `<p className="text-sm text-muted-foreground">{t("noItemsInOrder")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 391 | A | text-sm | `<label htmlFor={\`dt-item-${it.orderLineItemId}\`} className="flex-1 cursor-pointer text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 470 | A | text-sm | `<p className="text-muted-foreground text-sm m-0">{t("empty")}</p>` | text-sm → text-caption (--fs-caption: 14px) |

### `app/tai-khoan/don-hang/OrderHistoryContent.tsx`  (11)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 39 | A | text-sm | `"inline-flex h-9 items-center px-4 text-sm font-semibold uppercase font-cta border border-border transition-colors";` | text-sm → text-caption (--fs-caption: 14px) |
| 58 | A | text-sm | `{error && <p className="mb-4 text-sm text-brand">{error}</p>}` | text-sm → text-caption (--fs-caption: 14px) |
| 62 | A | text-sm | `<table className="w-full border-collapse text-left text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 88 | A | text-sm | `<p className="m-0 text-sm text-muted-foreground">{t("empty")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 94 | A | text-sm | `<table className="w-full border-collapse text-left text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 112 | A | text-xs | `<p className="m-0 mt-1 line-clamp-2 text-xs text-muted-foreground">` | text-xs → text-overline (--fs-overline: 12px) |
| 128 | A | text-sm | `className="inline-flex h-9 items-center justify-center bg-brand px-5 font-cta text-sm font-semibold uppercase text-white hover:bg-brand-hover"` | text-sm → text-caption (--fs-caption: 14px) |
| 147 | A | text-sm | `<span className="text-sm text-muted-foreground">{orderStatusLabelWithT(order.status, t)}</span>` | text-sm → text-caption (--fs-caption: 14px) |
| 150 | A | text-xs | `<p className="m-0 mt-1 line-clamp-2 text-xs text-muted-foreground">` | text-xs → text-overline (--fs-overline: 12px) |
| 154 | A | text-sm | `<dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 164 | A | text-sm | `className="mt-3 inline-flex h-11 w-full items-center justify-center bg-brand px-5 font-cta text-sm font-semibold uppercase text-white hover:bg-brand-hover"` | text-sm → text-caption (--fs-caption: 14px) |

### `app/tai-khoan/don-hang/[id]/OrderDetailContent.tsx`  (14)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 41 | A | text-sm | `<p className="m-0 text-sm text-muted-foreground">{t("loading")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 50 | A | text-sm | `<p className="mb-4 text-sm text-brand">{error \|\| t("notFound")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 51 | A | text-sm | `<Link href={toOrderHistoryPath()} className={cn(bbLink, "text-sm")}>` | text-sm → text-caption (--fs-caption: 14px) |
| 66 | A | text-sm | `<p className="mb-2 text-sm leading-relaxed text-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 75 | A | text-sm | `<p className="mb-5 text-sm text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 83 | A | text-sm | `<table className="w-full border-collapse text-left text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 139 | A | text-sm | `<div className="text-sm leading-relaxed text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 146 | A | text-sm | `<p className="m-0 text-sm text-muted-foreground">—</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 153 | A | text-sm | `<div className="text-sm leading-relaxed text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 160 | A | text-sm | `<p className="m-0 text-sm text-muted-foreground">—</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 165 | A | text-sm | `<div className="mt-6 text-sm text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 174 | A | text-sm | `<p className="mb-3 text-sm text-muted-foreground">{t("cancelDescription")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 184 | A | text-sm | `<p className="mt-2 text-sm text-brand">` | text-sm → text-caption (--fs-caption: 14px) |
| 192 | A | text-sm | `<Link href={toOrderHistoryPath()} className={cn(bbLink, "text-sm")}>` | text-sm → text-caption (--fs-caption: 14px) |

### `app/tai-khoan/edit-account/EditAccountContent.tsx`  (5)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 12 | A | text-sm | `const LEGACY_LABEL = "text-sm text-muted-foreground";` | text-sm → text-caption (--fs-caption: 14px) |
| 82 | A | text-sm | `<p className="mb-5 text-sm leading-relaxed text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 107 | A | text-sm | `<legend className="mb-3 text-sm text-muted-foreground">{t("changePassword")}</legend>` | text-sm → text-caption (--fs-caption: 14px) |
| 108 | A | text-sm | `<p className="mb-3 text-sm text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 140 | A | text-sm | `{passwordError && <p className="mt-2 text-sm text-destructive">{passwordError}</p>}` | text-sm → text-caption (--fs-caption: 14px) |

### `app/tai-khoan/edit-address/[type]/AddressBookContent.tsx`  (10)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 21 | A | text-sm | `const LEGACY_LABEL = "text-sm text-muted-foreground";` | text-sm → text-caption (--fs-caption: 14px) |
| 113 | A | text-sm | `<p className="sm:col-span-3 text-sm text-destructive">{vnError}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 129 | A | text-sm | `<label className="flex items-center gap-2 text-sm text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 285 | A | text-base | `<b className="font-body text-base font-semibold text-foreground">` | text-base → text-body (--fs-body: 16px) |
| 288 | A | text-sm | `<span className="shrink-0 text-sm text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 293 | A | text-sm | `<div className="mt-4 flex flex-col gap-[10px] text-sm text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 318 | A | text-sm | `<span className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-brand">` | text-sm → text-caption (--fs-caption: 14px) |
| 326 | A | text-sm | `className="inline-flex min-h-11 items-center text-sm font-bold uppercase tracking-wide text-discount hover:underline"` | text-sm → text-caption (--fs-caption: 14px) |
| 364 | A | text-sm | `className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-bold uppercase tracking-wide text-brand hover:underline"` | text-sm → text-caption (--fs-caption: 14px) |
| 371 | A | text-sm | `<p className="mt-3 text-sm text-muted-foreground">{t("empty")}</p>` | text-sm → text-caption (--fs-caption: 14px) |

### `app/xac-nhan-email/VerifyEmailContent.tsx`  (4)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 89 | A | text-sm | `<p className="m-0 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-sm text-state-success-text">` | text-sm → text-caption (--fs-caption: 14px) |
| 97 | A | text-sm | `{resendStatus === "error" && <p className="mt-2 text-sm text-destructive">{resendMsg}</p>}` | text-sm → text-caption (--fs-caption: 14px) |
| 133 | A | text-sm | `<p className="mt-4 border border-[var(--bb-state-success-border)] bg-[var(--bb-state-success-bg)] p-3 text-sm text-state-success-text">` | text-sm → text-caption (--fs-caption: 14px) |
| 137 | A | text-sm | `{resendStatus === "error" && <p className="mt-4 text-sm text-destructive">{resendMsg}</p>}` | text-sm → text-caption (--fs-caption: 14px) |

### `components/auth/SocialLoginButtons.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 41 | A | text-sm | `"flex h-[52px] w-full items-center justify-center gap-3 text-sm font-semibold transition-colors no-underline!";` | text-sm → text-caption (--fs-caption: 14px) |

### `components/catalog/CatalogFilters.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 75 | A | text-sm | `"relative block pr-5 text-sm font-semibold leading-[1.3] text-muted-foreground no-underline hover:text-brand";` | text-sm → text-caption (--fs-caption: 14px) |
| 109 | A | text-sm | `<span className="relative z-[2] text-sm leading-5">{value}</span>` | text-sm → text-caption (--fs-caption: 14px) |

### `components/catalog/FeaturedSpecsBar.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 33 | A | text-2xl, text-3xl | `<span className="font-cta text-2xl font-bold uppercase leading-none tracking-tight text-brand md:text-3xl">` | text-2xl → text-h2 (22px) hoặc text-h1 (24px) ; text-3xl → text-h1 (24px) hoặc text-display (40px) |

### `components/catalog/MobilePdpAnchorNav.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 223 | A | text-xs | `"font-body text-xs font-bold uppercase tracking-normal whitespace-nowrap cursor-pointer -mb-px min-h-11",` | text-xs → text-overline (--fs-overline: 12px) |

### `components/catalog/MobileStickyPurchaseBar.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 86 | A | text-sm | `"h-14 rounded-none font-body text-sm font-bold uppercase tracking-normal cursor-pointer active:opacity-85";` | text-sm → text-caption (--fs-caption: 14px) |

### `components/catalog/ProductCard.tsx`  (13)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 37 | A | text-sm | `const STOCK_BADGE_BASE = "rounded-none font-body text-sm font-bold leading-3";` | text-sm → text-caption (--fs-caption: 14px) |
| 105 | A | text-base | `: "flex items-center justify-center gap-2.5 py-[15px] font-cta text-base font-semibold uppercase leading-6 text-white";` | text-base → text-body (--fs-body: 16px) |
| 118 | A | text-sm | `? "mt-1 block text-left font-body text-sm font-semibold text-brand md:mt-0"` | text-sm → text-caption (--fs-caption: 14px) |
| 121 | A | text-sm | `? "mr-5 inline-block text-sm leading-[1.214rem] text-brand"` | text-sm → text-caption (--fs-caption: 14px) |
| 122 | A | text-sm | `: "m-0 font-body text-sm font-semibold leading-6 text-brand";` | text-sm → text-caption (--fs-caption: 14px) |
| 124 | A | text-sm | `? "mr-5 inline-block text-sm leading-[1.214rem] text-muted-foreground line-through"` | text-sm → text-caption (--fs-caption: 14px) |
| 125 | A | text-sm | `: "m-0 text-sm leading-[1.214rem] text-muted-foreground line-through";` | text-sm → text-caption (--fs-caption: 14px) |
| 274 | A | text-sm | `<div className="text-left font-cta text-sm font-semibold text-brand">` | text-sm → text-caption (--fs-caption: 14px) |
| 275 | A | text-sm | `<p className="mr-5 inline-block text-sm leading-[1.214rem] text-brand max-[767px]:leading-[1.2]">` | text-sm → text-caption (--fs-caption: 14px) |
| 279 | A | text-sm | `<p className="mr-5 inline-block text-sm leading-[1.214rem] text-muted-foreground line-through max-[767px]:leading-[1.2]">` | text-sm → text-caption (--fs-caption: 14px) |
| 298 | A | text-base | `const priceCurrentClass = "font-cta text-base font-semibold leading-6 text-brand";` | text-base → text-body (--fs-body: 16px) |
| 336 | A | text-sm | `<p className="font-cta text-sm uppercase tracking-normal text-brand">{brandName}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 341 | A | text-sm | `<div className="text-sm tracking-normal">` | text-sm → text-caption (--fs-caption: 14px) |

### `components/catalog/ProductCardAddBar.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 51 | A | text-sm | `className="absolute left-0 right-0 bottom-0 bg-black text-white py-3.5 text-center font-body text-sm font-semibold tracking-display uppercase translate-y-full transition-[transform,background-color] duration-[320ms] z-[2] cursor-pointer w-f` | text-sm → text-caption (--fs-caption: 14px) |

### `components/catalog/ProductDescriptionBlocks.tsx`  (7)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 101 | A | text-sm | `<figcaption className="mt-2 text-sm italic text-muted-foreground">{block.caption}</figcaption>` | text-sm → text-caption (--fs-caption: 14px) |
| 126 | A | text-sm | `<figcaption className="mt-2 text-sm italic text-muted-foreground">{block.caption}</figcaption>` | text-sm → text-caption (--fs-caption: 14px) |
| 141 | A | text-lg | `<h3 className="font-heading text-lg font-bold uppercase leading-tight text-foreground">{text}</h3>` | text-lg → text-h4 (--fs-h4: 18px) |
| 145 | A | text-2xl, text-3xl | `<h2 className="flex gap-3 font-heading text-2xl font-bold uppercase leading-tight text-foreground md:text-3xl">` | text-2xl → text-h2 (22px) hoặc text-h1 (24px) ; text-3xl → text-h1 (24px) hoặc text-display (40px) |
| 216 | A | text-xs | `<p className="-mb-2 font-heading text-xs font-bold uppercase tracking-[0.2em] text-brand">` | text-xs → text-overline (--fs-overline: 12px) |
| 221 | A | text-2xl, text-3xl | `<h2 className="flex gap-3 font-heading text-2xl font-bold uppercase leading-tight text-foreground md:text-3xl">` | text-2xl → text-h2 (22px) hoặc text-h1 (24px) ; text-3xl → text-h1 (24px) hoặc text-display (40px) |
| 288 | A | text-sm | `<figcaption className="mt-2 text-sm italic text-muted-foreground">` | text-sm → text-caption (--fs-caption: 14px) |

### `components/catalog/ProductLocalizedParts.tsx`  (9)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 62 | A | text-lg | `<table className="shop_attributes w-full border-collapse text-lg">` | text-lg → text-h4 (--fs-h4: 18px) |
| 68 | A | text-base | `className="w-[38%] px-3.5 py-3.5 text-left align-top text-base font-semibold uppercase tracking-wide text-muted-foreground"` | text-base → text-body (--fs-body: 16px) |
| 72 | A | text-lg | `<td className="px-3.5 py-3.5 align-top text-lg text-foreground">{s.value}</td>` | text-lg → text-h4 (--fs-h4: 18px) |
| 102 | A | text-lg | `className="shrink-0 font-cta text-lg font-bold leading-none tabular-nums text-brand"` | text-lg → text-h4 (--fs-h4: 18px) |
| 198 | A | text-xs | `<div className="mb-3 flex items-center gap-2 font-cta text-xs font-bold uppercase tracking-wide text-brand">` | text-xs → text-overline (--fs-overline: 12px) |
| 206 | A | text-lg | `<h3 className="mb-2 font-heading text-lg font-bold uppercase tracking-wide text-foreground">` | text-lg → text-h4 (--fs-h4: 18px) |
| 240 | A | text-sm | `<p className="mb-1 font-heading text-sm font-bold uppercase tracking-wide text-foreground">` | text-sm → text-caption (--fs-caption: 14px) |
| 284 | A | text-lg | `<h2 className="mb-3 font-heading text-lg font-bold uppercase tracking-wide text-pros-accent"><Tr ns="Product" k="prosTitle" /></h2>` | text-lg → text-h4 (--fs-h4: 18px) |
| 297 | A | text-lg | `<h2 className="mb-3 font-heading text-lg font-bold uppercase tracking-wide text-cons-accent"><Tr ns="Product" k="consTitle" /></h2>` | text-lg → text-h4 (--fs-h4: 18px) |

### `components/catalog/ProductTabs.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 67 | A | text-base, text-sm | `"relative block w-full h-[42px] border-none bg-transparent text-[var(--bb-text-secondary)] font-body text-base font-semibold leading-[42px] text-center whitespace-nowrap no-underline normal-case cursor-pointer after:content-[''] after:absol` | text-base → text-body (--fs-body: 16px) ; text-sm → text-caption (--fs-caption: 14px) |
| 100 | A | text-lg | `"max-md:before:content-[attr(data-label)] max-md:before:block max-md:before:mb-4 max-md:before:font-body max-md:before:text-lg max-md:before:font-semibold max-md:before:text-[var(--bb-text-primary)] max-md:before:uppercase max-md:before:tra` | text-lg → text-h4 (--fs-h4: 18px) |

### `components/catalog/ProductView.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 187 | A | text-base | `<dd className="m-0 font-heading text-base font-semibold">{item.value}</dd>` | text-base → text-body (--fs-body: 16px) |
| 188 | A | text-xs | `<dt className="mt-1 text-xs uppercase tracking-wide text-muted-foreground">` | text-xs → text-overline (--fs-overline: 12px) |

### `components/catalog/PurchaseSectionClient.tsx`  (3)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 335 | A | text-sm | `<p className="m-0 text-sm text-muted-foreground">{t("outOfStockNote")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 408 | A | text-sm | `<p className="mt-2.5 text-sm text-brand" role="alert">` | text-sm → text-caption (--fs-caption: 14px) |
| 470 | A | text-sm | `<span className="ml-2 text-sm font-medium text-brand" role="status">` | text-sm → text-caption (--fs-caption: 14px) |

### `components/catalog/QuickBuyModal.tsx`  (27)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 200 | A | text-base | `<DialogTitle className="text-base font-bold uppercase tracking-wide">` | text-base → text-body (--fs-body: 16px) |
| 203 | A | text-sm | `<div className="mt-1 text-sm text-muted-foreground space-y-0.5">` | text-sm → text-caption (--fs-caption: 14px) |
| 206 | A | text-xs | `<p className="text-xs">{variantLabel}</p>` | text-xs → text-overline (--fs-overline: 12px) |
| 209 | A | text-sm | `<p className="text-sm font-semibold text-brand">` | text-sm → text-caption (--fs-caption: 14px) |
| 222 | A | text-xs | `<p className="text-xs font-semibold uppercase tracking-display text-muted-foreground mb-3">` | text-xs → text-overline (--fs-overline: 12px) |
| 270 | A | text-xs | `<p className="text-xs font-semibold uppercase tracking-display text-muted-foreground mb-3">` | text-xs → text-overline (--fs-overline: 12px) |
| 284 | A | text-sm | `labelClassName="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"` | text-sm → text-caption (--fs-caption: 14px) |
| 288 | A | text-sm | `<p className="text-sm font-medium text-destructive">{form.formState.errors.province.message}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 291 | A | text-sm | `<p className="text-sm font-medium text-destructive">{form.formState.errors.district.message}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 323 | A | text-lg | `className="px-3 h-10 text-lg font-medium hover:bg-muted disabled:opacity-40"` | text-lg → text-h4 (--fs-h4: 18px) |
| 330 | A | text-sm | `<span className="px-4 h-10 flex items-center justify-center min-w-[3rem] text-sm font-semibold tabular-nums select-none">` | text-sm → text-caption (--fs-caption: 14px) |
| 335 | A | text-lg | `className="px-3 h-10 text-lg font-medium hover:bg-muted disabled:opacity-40"` | text-lg → text-h4 (--fs-h4: 18px) |
| 353 | A | text-xs | `<p className="text-xs font-semibold uppercase tracking-display text-muted-foreground mb-3">` | text-xs → text-overline (--fs-overline: 12px) |
| 357 | A | text-sm | `<p className="text-sm text-muted-foreground">{tQb("summaryShippingUnknown")}</p>` | text-sm → text-caption (--fs-caption: 14px) |
| 359 | A | text-sm | `<div className="flex items-center justify-between px-3 py-2.5 border border-border text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 397 | A | text-sm | `<span className="text-sm font-medium">{method.title}</span>` | text-sm → text-caption (--fs-caption: 14px) |
| 399 | A | text-xs | `<span className="text-xs text-muted-foreground">` | text-xs → text-overline (--fs-overline: 12px) |
| 405 | A | text-sm | `<span className={cn("text-sm font-semibold tabular-nums shrink-0", isFree && "text-state-success-text")}>` | text-sm → text-caption (--fs-caption: 14px) |
| 418 | A | text-xs | `<p className="text-xs font-semibold uppercase tracking-display text-muted-foreground mb-3">` | text-xs → text-overline (--fs-overline: 12px) |
| 443 | A | text-sm | `<span className="text-sm font-medium">` | text-sm → text-caption (--fs-caption: 14px) |
| 447 | A | text-xs | `<span className="text-xs text-muted-foreground">{tQb("paymentBacsHint")}</span>` | text-xs → text-overline (--fs-overline: 12px) |
| 478 | A | text-sm | `<p className="text-sm font-medium text-destructive" role="alert">` | text-sm → text-caption (--fs-caption: 14px) |
| 486 | A | text-sm | `<div className="mx-6 mb-4 border border-border text-sm">` | text-sm → text-caption (--fs-caption: 14px) |
| 497 | A | text-xs | `? <span className="text-muted-foreground text-xs">{tQb("summaryShippingSelectProvince")}</span>` | text-xs → text-overline (--fs-overline: 12px) |
| 499 | A | text-xs | `? <span className="text-muted-foreground text-xs">{tQb("summaryShippingUnknown")}</span>` | text-xs → text-overline (--fs-overline: 12px) |
| 514 | A | text-xs | `<span className="text-xs font-normal text-muted-foreground ml-1">+ {tQb("summaryShippingUnknown")}</span>` | text-xs → text-overline (--fs-overline: 12px) |
| 522 | A | text-xs | `<p className="px-6 pb-2 text-xs text-muted-foreground">` | text-xs → text-overline (--fs-overline: 12px) |

### `components/catalog/QuickBuySuccessModal.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 56 | A | text-sm | `<p className="text-sm text-state-warning-text bg-[var(--bb-state-warning-bg)] px-3 py-2 border border-[var(--bb-state-warning-border)]">` | text-sm → text-caption (--fs-caption: 14px) |

### `components/catalog/ReviewsSection.tsx`  (5)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 158 | A | text-lg | `<span className="font-body text-lg font-semibold text-[var(--bb-text-primary)]">` | text-lg → text-h4 (--fs-h4: 18px) |
| 184 | A | text-5xl | `<span className="font-cta text-5xl font-semibold leading-none text-[var(--bb-text-primary)]">` | text-5xl → text-h1 (24px) hoặc text-display (40px) |
| 320 | A | text-lg | `className="flex h-10 w-10 shrink-0 items-center justify-center bg-muted font-body text-lg font-semibold text-[var(--bb-text-primary)]"` | text-lg → text-h4 (--fs-h4: 18px) |
| 393 | A | text-lg | `<p className="m-0 font-cta text-lg font-semibold uppercase tracking-wide text-[var(--bb-text-primary)]">` | text-lg → text-h4 (--fs-h4: 18px) |
| 549 | A | text-lg | `<h3 className="m-0 mb-5 font-body text-lg font-semibold uppercase tracking-wide text-[var(--bb-text-primary)]">` | text-lg → text-h4 (--fs-h4: 18px) |

### `components/catalog/SaleBadge.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 39 | A | text-base | `<p className="relative m-0 w-[70px] bg-brand text-center font-body text-base font-semibold leading-[42px] text-white after:absolute after:right-[-33px] after:top-0 after:h-0 after:w-0 after:border-b-0 after:border-l-[42px] after:border-r-[3` | text-base → text-body (--fs-body: 16px) |

### `components/catalog/StockStatus.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 74 | A | text-sm | `<span className="inline-flex items-center gap-2 text-sm">` | text-sm → text-caption (--fs-caption: 14px) |

### `components/content/ArticleCard.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 99 | A | text-sm | `<span className="absolute -top-[21px] left-0 z-[2] inline-flex items-center h-[42px] min-w-[168px] pl-[22px] pr-[28px] bg-brand text-white font-body text-sm font-bold tracking-wide uppercase whitespace-nowrap [clip-path:polygon(0_0,100%_0,c` | text-sm → text-caption (--fs-caption: 14px) |
| 116 | A | text-sm | `<span className="mt-auto pt-[6px] text-muted-foreground text-sm font-bold tracking-display uppercase transition-colors duration-300 group-hover:text-brand">` | text-sm → text-caption (--fs-caption: 14px) |

### `components/layout/FooterCollapsible.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 15 | A | text-base | `<h3 className="m-0 font-body text-base font-medium uppercase text-brand-on-dark">` | text-base → text-body (--fs-body: 16px) |
| 27 | A | text-xl | `<span className="text-xl leading-none" aria-hidden="true">` | text-xl → text-h3 (--fs-h3: 20px) |

### `components/layout/HeaderNavItem.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 105 | A | text-sm | `"block py-1 font-body text-sm leading-snug text-foreground/75 no-underline transition-colors duration-150 hover:text-brand",` | text-sm → text-caption (--fs-caption: 14px) |

### `components/layout/LanguageSwitcher.tsx`  (3)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 100 | A | text-xs | `className="inline-flex h-11 self-center items-stretch rounded-none border border-white/15 bg-white/5 text-xs font-bold"` | text-xs → text-overline (--fs-overline: 12px) |
| 171 | A | text-xs | `<span className="font-cta text-xs font-bold uppercase w-5 shrink-0">{code.toUpperCase()}</span>` | text-xs → text-overline (--fs-overline: 12px) |
| 172 | A | text-xs | `<span className="text-xs font-normal normal-case">{LOCALE_LABELS[code]}</span>` | text-xs → text-overline (--fs-overline: 12px) |

### `components/layout/MobileBottomNav.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 21 | A | text-xs | `"text-xs leading-none max-w-full overflow-hidden text-ellipsis whitespace-nowrap max-[375px]:text-ui-10";` | text-xs → text-overline (--fs-overline: 12px) |

### `components/layout/MobileHeaderMenu.tsx`  (5)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 51 | A | text-base | `"md:px-[25px] md:py-5 md:text-base " +` | text-base → text-body (--fs-body: 16px) |
| 291 | A | text-base | `<p className="m-0 text-base font-semibold uppercase">{t("loggedInGreeting")}</p>` | text-base → text-body (--fs-body: 16px) |
| 294 | A | text-base | `className="block text-base font-semibold normal-case"` | text-base → text-body (--fs-body: 16px) |
| 322 | A | text-base | `<div className="text-base text-white md:text-foreground">` | text-base → text-body (--fs-body: 16px) |
| 351 | A | text-base | `<h2 className="m-0 font-body text-base font-semibold uppercase text-white md:text-foreground">` | text-base → text-body (--fs-body: 16px) |

### `components/ui/AuthField.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 72 | A | text-sm | `className="text-sm text-destructive"` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/FormNotice.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 32 | A | text-sm | `<div className={cn("border p-[12px_16px] text-sm", TONE_CLASS[tone], className)}>` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/FormRootError.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 12 | A | text-sm | `<p role="alert" aria-live="assertive" className="mb-5 text-sm font-medium text-destructive">` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/MediaImage.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 54 | A | text-sm | `className={\`flex w-full min-h-[200px] items-center justify-center border-b border-border bg-secondary p-4 text-center text-sm text-muted-foreground ${className ?? ""}\`}` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/PaginationNav.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 122 | A | text-sm | `<span key={\`ellipsis-${i}\`} className="inline-flex h-9 min-w-7 items-center justify-center text-sm text-muted-foreground">...</span>` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/QuantityStepper.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 38 | A | text-lg | `"flex items-center justify-center w-9 min-h-[44px] text-lg leading-none text-foreground " +` | text-lg → text-h4 (--fs-h4: 18px) |
| 73 | A | text-sm | `"font-bold text-sm text-foreground outline-none focus-visible:bg-secondary",` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/StatusBadge.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 37 | A | text-sm | `"inline-block border font-bold uppercase text-sm leading-none tracking-display py-1.5 px-2.5",` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/VnAddressFields.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 30 | A | text-sm | `export function VnAddressFields({ value, onChange, required, labelClassName = "text-sm font-semibold tracking-wide uppercase text-muted-foreground", selectContentClassName }: VnAddressFieldsProps) {` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/accordion.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 26 | A | text-sm | `"flex flex-1 items-center justify-between py-3 font-body text-sm font-semibold uppercase text-foreground transition-all hover:text-primary focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 [&[data-state=open]` | text-sm → text-caption (--fs-caption: 14px) |
| 44 | A | text-sm | `className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down"` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/badge.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 6 | A | text-sm | `"inline-flex items-center gap-1 min-h-[24px] px-2 py-1 rounded-none font-body text-sm font-bold leading-none uppercase tracking-normal",` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/button.tsx`  (5)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 8 | A | text-base | `"inline-flex items-center justify-center gap-2 min-h-[44px] px-8 py-4 border border-transparent font-cta text-base font-semibold uppercase tracking-normal transition-[background-color,border-color,color,transform] duration-[var(--bb-duratio` | text-base → text-body (--fs-body: 16px) |
| 26 | A | text-sm | `sm: "min-h-[36px] px-4 py-2 text-sm",` | text-sm → text-caption (--fs-caption: 14px) |
| 27 | A | text-base | `md: "min-h-[44px] px-8 py-4 text-base",` | text-base → text-body (--fs-body: 16px) |
| 28 | A | text-lg | `lg: "min-h-[52px] px-10 py-4 text-lg",` | text-lg → text-h4 (--fs-h4: 18px) |
| 29 | A | text-sm | `auth: "min-h-[52px] w-full py-0 text-sm hover:not-disabled:scale-100",` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/card.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 33 | A | text-lg | `className={cn("font-body text-lg font-semibold uppercase leading-tight", className)}` | text-lg → text-h4 (--fs-h4: 18px) |
| 43 | A | text-sm | `<p ref={ref} className={cn("text-sm text-muted-foreground", className)} {...props} />` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/dialog.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 75 | A | text-lg | `className={cn("font-body text-lg font-semibold uppercase leading-tight text-foreground", className)}` | text-lg → text-h4 (--fs-h4: 18px) |
| 87 | A | text-sm | `className={cn("text-sm text-muted-foreground", className)}` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/dropdown-menu.tsx`  (6)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 24 | A | text-sm | `"flex cursor-default select-none items-center gap-2 px-3 py-2 text-sm font-body text-foreground outline-none focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground",` | text-sm → text-caption (--fs-caption: 14px) |
| 78 | A | text-sm | `"relative flex cursor-default select-none items-center gap-2 px-3 py-2 text-sm font-body text-foreground outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity` | text-sm → text-caption (--fs-caption: 14px) |
| 94 | A | text-sm | `"relative flex cursor-default select-none items-center py-2 pl-8 pr-3 text-sm font-body text-foreground outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-` | text-sm → text-caption (--fs-caption: 14px) |
| 117 | A | text-sm | `"relative flex cursor-default select-none items-center py-2 pl-8 pr-3 text-sm font-body text-foreground outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-` | text-sm → text-caption (--fs-caption: 14px) |
| 141 | A | text-sm | `"px-3 py-1.5 text-sm font-semibold font-body uppercase text-muted-foreground",` | text-sm → text-caption (--fs-caption: 14px) |
| 167 | A | text-sm | `className={cn("ml-auto text-sm tracking-display text-muted-foreground", className)}` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/form.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 135 | A | text-sm | `className={cn("text-sm text-muted-foreground", className)}` | text-sm → text-caption (--fs-caption: 14px) |
| 157 | A | text-sm | `className={cn("text-sm font-medium text-destructive", className)}` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/input.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 12 | A | text-base | `"flex w-full min-h-[48px] px-4 py-3 border border-border-control rounded-none bg-white text-foreground font-body text-base font-normal leading-6 placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-[var(--bb-durat` | text-base → text-body (--fs-body: 16px) |

### `components/ui/label.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 14 | A | text-sm | `"font-body text-sm font-medium leading-none text-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-60",` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/navigation-menu.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 44 | A | text-sm | `"group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none ` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/select.tsx`  (3)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 19 | A | text-base | `"flex w-full items-center justify-between min-h-[48px] px-4 py-3 bg-white border border-border-control rounded-none font-body text-base text-foreground placeholder:text-muted-foreground transition-[border-color,box-shadow] duration-[var(--b` | text-base → text-body (--fs-body: 16px) |
| 97 | A | text-sm | `className={cn("px-3 py-1.5 text-sm font-semibold font-body uppercase text-muted-foreground", className)}` | text-sm → text-caption (--fs-caption: 14px) |
| 110 | A | text-sm | `"relative flex w-full cursor-default select-none items-center py-2 pl-8 pr-3 text-sm font-body text-foreground outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-60",` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/sheet.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 99 | A | text-lg | `className={cn("font-body text-lg font-semibold uppercase leading-tight text-foreground", className)}` | text-lg → text-h4 (--fs-h4: 18px) |
| 111 | A | text-sm | `className={cn("text-sm text-muted-foreground", className)}` | text-sm → text-caption (--fs-caption: 14px) |

### `components/ui/textarea.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 11 | A | text-base | `"flex w-full min-h-[120px] px-4 py-3 border border-border-control rounded-none bg-white text-foreground font-body text-base font-normal leading-6 placeholder:text-muted-foreground resize-y transition-[border-color,box-shadow] duration-[var(` | text-base → text-body (--fs-body: 16px) |

### `components/ui/tooltip.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 20 | A | text-xs | `"z-[var(--bb-z-modal-dropdown)] overflow-hidden bg-surface-dark px-3 py-1.5 font-body text-xs text-white animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[si` | text-xs → text-overline (--fs-overline: 12px) |

### `components/wp/WpAuthField.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 46 | A | text-sm | `{error && <p role="alert" className="mt-2 text-sm text-destructive">{error.message}</p>}` | text-sm → text-caption (--fs-caption: 14px) |

### `components/wp/WpCheckoutClient.tsx`  (3)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 72 | A | text-sm | `return <p className="m-0 mt-1 text-sm text-brand">{message}</p>;` | text-sm → text-caption (--fs-caption: 14px) |
| 541 | A | text-base | `<h3 className="mb-3 mt-1 font-cta text-base font-semibold uppercase">{t("shippingAddressTitle")}</h3>` | text-base → text-body (--fs-body: 16px) |
| 688 | A | text-sm | `<p className="m-0 mt-1 text-sm text-[var(--bb-text-secondary)]">` | text-sm → text-caption (--fs-caption: 14px) |

### `components/wp/WpFooter.tsx`  (1)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 39 | B | fontSize: 1.143rem | `fontSize: "1.143rem",` | ≈18px → var(--fs-h4) / text-h4 (kiểm tra brand-tokens.css) |

### `components/wp/WpLangSwitch.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 28 | A | text-xs | `{i > 0 && <span className="!text-white opacity-40 px-1 text-xs select-none">/</span>}` | text-xs → text-overline (--fs-overline: 12px) |
| 34 | A | text-xs | `className={\`bg-transparent border-none cursor-pointer !text-white text-xs leading-none px-1 py-0 hover:opacity-100 ${code === locale ? "is-active opacity-100 font-bold" : "opacity-60"}\`}` | text-xs → text-overline (--fs-overline: 12px) |

### `components/wp/WpProductTabs.tsx`  (2)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 124 | A | text-lg | `<h2 className="md:hidden !mb-4 flex items-center gap-2.5 font-body text-lg font-semibold text-[var(--bb-text-primary)] uppercase leading-[1.2]">` | text-lg → text-h4 (--fs-h4: 18px) |
| 127 | A | text-xs | `<span className="inline-flex shrink-0 items-center justify-center bg-brand px-1.5 py-0.5 font-heading text-xs font-bold leading-none text-white tabular-nums">` | text-xs → text-overline (--fs-overline: 12px) |

### `components/wp/WpPurchaseSection.tsx`  (3)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 492 | A | text-2xl | `className="h-[52px] w-16 border-x border-border-control bg-white text-center font-body text-2xl font-semibold text-foreground [appearance:textfield] focus:outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-bu` | text-2xl → text-h2 (22px) hoặc text-h1 (24px) |
| 562 | A | text-base | `<strong className="block font-body text-base font-semibold leading-snug text-foreground">{c.title}</strong>` | text-base → text-body (--fs-body: 16px) |
| 563 | A | text-sm | `{c.subtitle ? <span className="mt-1 block text-sm leading-snug text-muted-foreground">{c.subtitle}</span> : null}` | text-sm → text-caption (--fs-caption: 14px) |

### `lib/cart-context.tsx`  (3)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 85 | A | text-sm | `<b className="block text-sm font-bold tracking-display uppercase text-brand mb-[2px]">{toast.title}</b>` | text-sm → text-caption (--fs-caption: 14px) |
| 86 | A | text-sm | `<span className="text-sm text-muted-foreground">{toast.message}</span>` | text-sm → text-caption (--fs-caption: 14px) |
| 88 | A | text-sm | `<Link href={toCartPath()} className="text-sm font-bold text-brand no-underline whitespace-nowrap tracking-wide shrink-0 hover:text-brand-hover">` | text-sm → text-caption (--fs-caption: 14px) |

### `lib/ui-classes.ts`  (8)

| Line | Loại | Vi phạm | Đoạn code | Gợi ý |
|---|---|---|---|---|
| 46 | A | text-sm | `export const fieldLabel = "text-sm font-bold uppercase tracking-display text-muted-foreground";` | text-sm → text-caption (--fs-caption: 14px) |
| 57 | A | text-base | `export const sectionSubheading = "font-body text-base font-semibold uppercase text-foreground";` | text-base → text-body (--fs-body: 16px) |
| 59 | A | text-base | `export const stateTitle = "m-0 font-body text-base font-semibold uppercase text-foreground";` | text-base → text-body (--fs-body: 16px) |
| 61 | A | text-sm | `export const metaLabel = "text-sm uppercase tracking-display text-muted-foreground";` | text-sm → text-caption (--fs-caption: 14px) |
| 63 | A | text-xs | `export const tableHeader = "font-body text-xs font-semibold uppercase tracking-wide";` | text-xs → text-overline (--fs-overline: 12px) |
| 65 | A | text-sm | `export const detailTableCell = "mt-[3px] block text-sm font-bold normal-case tracking-wide text-foreground";` | text-sm → text-caption (--fs-caption: 14px) |
| 67 | A | text-sm | `export const categoryBadge = "m-0 text-sm font-bold uppercase tracking-display text-brand";` | text-sm → text-caption (--fs-caption: 14px) |
| 73 | A | text-sm | `export const authInput = "h-[52px] min-h-[52px] px-5 py-0 text-sm";` | text-sm → text-caption (--fs-caption: 14px) |

---

## Ghi chú

- **[A] chiếm phần lớn**: phần lớn nằm trong `components/ui/*` (primitive shadcn/ui) và các màn nội dung. Đây là scale built-in của Tailwind (`text-xs/sm/base/lg/xl/2xl/3xl…`), được `globals.css` xác nhận "uses Tailwind defaults" — không truy vết về token typography. Muốn đồng bộ tuyệt đối thì thay bằng utility token tương ứng ở bảng trên.
- **[B]**: chỉ tính `fontSize:` trong object style. Trường hợp `fontSize="13"` trong `components/ui/ZaloIcon.tsx` là thuộc tính SVG `<text>` (đơn vị toạ độ SVG, không phải CSS typography) → KHÔNG tính vi phạm.
- **[C]/[D] = 0 trong phạm vi**: toàn bộ `font-size` hardcode/var hợp-lệ-hoặc-không đều nằm trong 2 file token bị loại trừ (`globals.css`, `brand-tokens.css`) hoặc trong `public/wp-content/` (legacy WP). `globals.css` tự nó dùng đúng `var(--fs-*)/var(--bb-text-*)/var(--text-ui-*)`.
