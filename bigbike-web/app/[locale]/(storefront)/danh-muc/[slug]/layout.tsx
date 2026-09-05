import { notFound, permanentRedirect } from "next/navigation";

import { toCategoryPath } from "@/lib/utils/routes";
import { isValidSlug } from "@/lib/utils/slug";
import type { Locale } from "@/i18n/locale";
import { getCategoryByRouteSlug } from "./resolve-category";

/**
 * Chốt chặn 404 / chuyển hướng của trang danh mục, đặt ở layout — TRÊN `loading.tsx`
 * trong cây route của Next, nên nó chạy xong trước khi khung chờ bắt đầu phát nội
 * dung. Nhờ vậy danh mục không tồn tại vẫn trả đúng "không tìm thấy" và slug tiếng
 * Anh vẫn chuyển hướng chuẩn, trong khi khách bấm vào là thấy khung chờ ngay.
 *
 * Bất biến này được khoá bằng __tests__/seo/render-boundaries.test.ts.
 */
export default async function CategoryGuardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { slug, locale } = (await params) as { locale: Locale; slug: string };
  if (!isValidSlug(slug)) notFound();

  const categoryResult = await getCategoryByRouteSlug(slug, locale);
  // Chỉ chặn khi backend khẳng định không có danh mục. Backend lỗi/không phản hồi
  // thì để page.tsx dựng màn "tải danh mục thất bại" như trước.
  if (!categoryResult.data && categoryResult.error?.status === 404) notFound();
  if (!categoryResult.data) return <>{children}</>;

  const category = categoryResult.data;
  const preferredSlug = locale === "en" ? category.slugEn?.trim() || category.slug : category.slug;
  if (slug !== preferredSlug) permanentRedirect(toCategoryPath(preferredSlug, locale));

  return <>{children}</>;
}
