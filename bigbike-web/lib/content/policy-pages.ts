import { getStaticPage } from "./static-pages";

/** Đúng bảy mục mới theo danh sách SEO (POLICY_PAGE_RULE_001/002). */
export const POLICY_PAGES = [
  { id: "privacy", slug: "chinh-sach-bao-mat-thong-tin" },
  { id: "pricing", slug: "chinh-sach-gia" },
  { id: "complaints", slug: "chinh-sach-giai-quyet-khieu-nai" },
  { id: "payment", slug: "chinh-sach-thanh-toan" },
  { id: "returns", slug: "chinh-sach-doi-tra-hang" },
  { id: "conditions", slug: "dieu-kien-giao-dich" },
  { id: "rights", slug: "quyen-va-nghia-vu" },
] as const;

/** Bảo hành cũ được giữ riêng theo ghi chú trong ảnh, ngoài bộ bảy mục mới. */
const RETAINED_POLICY_PAGES = [{ id: "warranty", slug: "chinh-sach-bao-hanh" }] as const;

export const POLICY_SLUGS: readonly string[] = [...POLICY_PAGES, ...RETAINED_POLICY_PAGES].map(
  ({ slug }) => slug,
);

export function getPolicyLinks(locale: string, currentSlug?: string) {
  return POLICY_PAGES.map(({ id, slug }) => ({
    id,
    href: `/chinh-sach/${slug}/`,
    label: getStaticPage(slug, locale)?.title ?? "BigBike",
    current: slug === currentSlug,
  }));
}

export function getRetainedPolicyLinks(locale: string) {
  return RETAINED_POLICY_PAGES.map(({ id, slug }) => ({
    id,
    href: `/chinh-sach/${slug}/`,
    label: getStaticPage(slug, locale)?.title ?? "BigBike",
  }));
}
