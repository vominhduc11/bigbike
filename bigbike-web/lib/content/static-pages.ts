import rawPages from "./static-pages.json";

// Nội dung 10 trang thông tin (chính sách, hướng dẫn, điều khoản…) ĐÃ ĐÓNG CỨNG trong code.
// Trước đây các trang này do admin quản lý qua bảng `pages` (module Nội dung → Trang). Owner
// chốt (2026-06-24) gỡ hẳn phần quản lý Trang; nội dung freeze tại đây, không còn gọi backend.
// Nguồn freeze: bảng `pages` tại thời điểm gỡ. Sửa nội dung = sửa file này + static-pages.json.

export type StaticPageRaw = {
  slug: string;
  title: string;
  titleEn: string | null;
  body: string;
  bodyEn: string | null;
  heroTitle: string | null;
  heroTitleEn: string | null;
  seoTitle: string | null;
  seoTitleEn: string | null;
  seoDescription: string | null;
  seoDescriptionEn: string | null;
  seoCanonicalUrl: string | null;
};

const PAGES = rawPages as Record<string, StaticPageRaw>;

export type LocalizedStaticPage = {
  slug: string;
  title: string;
  body: string;
  heroTitle: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoCanonicalUrl: string | null;
};

const isEn = (locale: string) => locale === "en";
const pick = (en: string | null, vi: string, locale: string): string => (isEn(locale) && en ? en : vi);
const pickN = (en: string | null, vi: string | null, locale: string): string | null =>
  isEn(locale) && en ? en : vi;

/** Trang thông tin tĩnh theo slug; null nếu slug không thuộc bộ đã đóng cứng. */
export function getStaticPage(slug: string, locale: string): LocalizedStaticPage | null {
  const p = PAGES[slug];
  if (!p) return null;
  return {
    slug: p.slug,
    title: pick(p.titleEn, p.title, locale),
    body: pick(p.bodyEn, p.body, locale),
    heroTitle: pickN(p.heroTitleEn, p.heroTitle, locale),
    seoTitle: pickN(p.seoTitleEn, p.seoTitle, locale),
    seoDescription: pickN(p.seoDescriptionEn, p.seoDescription, locale),
    seoCanonicalUrl: p.seoCanonicalUrl,
  };
}

export function staticPageSlugs(): string[] {
  return Object.keys(PAGES);
}

// ── Trang Hướng dẫn (/huong-dan): bố cục lưới ô + 2 trang con, đóng cứng (trước ở guide_page_layout).
export type StaticGuideEntry = {
  pathSegment: string;
  pageSlug: string;
  icon: string;
  title: string;
  description: string;
};

const GUIDE = {
  heroTitleVi: "Hướng dẫn chọn size sản phẩm",
  heroTitleEn: "Product sizing guides",
  entries: [
    {
      pathSegment: "size-mu",
      pageSlug: "cach-do-size-dau",
      icon: "HardHat",
      titleVi: "Cách xác định size mũ bảo hiểm",
      titleEn: "How to choose helmet size",
      descriptionVi: "Hướng dẫn đo chu vi đầu và chọn size mũ bảo hiểm phù hợp.",
      descriptionEn: "How to measure head circumference and choose the right helmet size.",
    },
    {
      pathSegment: "size-trang-phuc",
      pageSlug: "cach-do-size-trang-phuc",
      icon: "Ruler",
      titleVi: "Cách đo size trang phục bảo hộ",
      titleEn: "How to choose clothing size",
      descriptionVi: "Hướng dẫn đo và chọn size găng tay, giày, áo giáp, quần giáp bảo hộ.",
      descriptionEn: "How to measure and choose sizes for gloves, boots, jackets, and pants.",
    },
  ],
} as const;

export type StaticGuideLayout = {
  heroTitle: string;
  entries: StaticGuideEntry[];
};

export function getGuideLayout(locale: string): StaticGuideLayout {
  const en = isEn(locale);
  return {
    heroTitle: en ? GUIDE.heroTitleEn : GUIDE.heroTitleVi,
    entries: GUIDE.entries.map((e) => ({
      pathSegment: e.pathSegment,
      pageSlug: e.pageSlug,
      icon: e.icon,
      title: en ? e.titleEn : e.titleVi,
      description: en ? e.descriptionEn : e.descriptionVi,
    })),
  };
}
