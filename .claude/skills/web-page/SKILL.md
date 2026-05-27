---
name: web-page
description: Dùng khi thêm page/route mới vào bigbike-web (Next.js app router). Scaffold route directory theo convention dự án — async server component với params/searchParams await (Next 15 là Promise), generateMetadata qua buildPublicMetadata, data qua lib/api/public-api.ts, 'use client' chỉ cho child tương tác, shell PageHero/layout, và state loading/error/not-found. Gọi bằng /web-page <route slug>.
---

# /web-page — Scaffold page mới cho bigbike-web (Next.js app router)

## Bước 0 — Docs-First

Nếu page gọi API/shape mới → `/docs-first <mô tả>` (đọc `API_CONTRACT.md`, `API_FLOW_MAP.md`, `DATA_CONTRACT.md`). SEO behavior đọc `AGENTS.md` §12.

## Bước 1 — Tạo route directory

- Route tĩnh: `app/<viet-slug>/page.tsx` (slug tiếng Việt, ví dụ `lien-he`, `huong-dan`).
- Route động: `app/<viet-slug>/[slug]/page.tsx`.
- Exemplar: `app/danh-muc-san-pham/page.tsx` (list + filter), `app/product/[slug]/page.tsx` (dynamic + generateStaticParams).

## Bước 2 — Page = async server component, params là Promise (Next 15)

```tsx
type PageProps = {
  params: Promise<{ slug: string }>;                 // dynamic route
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function XxxPage({ params, searchParams }: PageProps) {
  const { slug } = await params;                      // PHẢI await
  const sp = await searchParams;
  const result = await getXxxBySlug(slug, await getLocale());
  if (!result.data) notFound();
  return ( /* JSX */ );
}
```

Server component mặc định. `"use client"` **chỉ** ở child tương tác (form, state, event) — page fetch rồi truyền data xuống child như props (xem `components/catalog/PurchaseSectionClient.tsx`).

## Bước 3 — SEO metadata

```tsx
import { buildPublicMetadata } from "@/lib/seo/metadata";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = (await getProductBySlug(slug, await getLocale())).data;
  if (!product) return buildPublicMetadata({ title: "...", canonicalPath: toProductPath(slug), noIndex: true });
  return buildPublicMetadata({
    title: product.name,
    description: product.shortDescription ?? "…",
    canonicalPath: toProductPath(product.slug),
  });
}
```

`noIndex: true` cho trang lọc/phân trang (page>1, có `q`/filter). Mọi public route phải có title + H1 — không để thiếu.

## Bước 4 — Data qua `lib/api/public-api.ts`

Dùng helper sẵn có (`listProducts`, `getProductBySlug`, `listArticles`…) — chúng đọc base URL từ `env.ts` (`BIGBIKE_API_BASE_URL`), set `revalidate` + cache tags. KHÔNG hardcode business data / fixture legacy (guard `check:no-runtime-business-data` chặn `WP_*`, email/phone/địa chỉ storefront cũ…). Cần endpoint mới → thêm helper vào `public-api.ts`.

## Bước 5 — Shell, special files, i18n, designed states

- Page nằm trong root `app/layout.tsx` (đã có `SiteHeader`/`SiteFooter`/providers) → **không** render lại header/footer. Dùng `PageHero` cho hero + breadcrumb.
- Thêm `loading.tsx` (skeleton từ `@/components/ui/Skeletons`), dựa vào `app/error.tsx` + `app/not-found.tsx` global; thêm `error.tsx`/`not-found.tsx` riêng route nếu cần.
- i18n: `next-intl` — `getLocale()`, `getTranslations("Ns")`; chuỗi trong `messages/`. Tiếng Việt có dấu đầy đủ.
- Designed states (AGENTS.md §5.3): loading / empty / error / success. Không render `null/undefined/NaN/[object Object]`.

## Bước 6 — UI stack

shadcn từ `components/ui`, Tailwind brand token (`text-primary`, `bg-brand`, `border-border`), `rounded-none` mặc định. Font: Barlow / Oswald / Barlow Condensed. Reuse `components/layout`, `components/catalog` (ProductCard, ProductGallery…) trước khi tạo mới.

## Bước 7 — Đóng gate

Chạy `/preflight` (web = `npm run lint` + `npm run test` + `npm run build`).
