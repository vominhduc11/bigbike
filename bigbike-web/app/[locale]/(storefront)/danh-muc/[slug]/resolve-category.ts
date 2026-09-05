import { getCategoryBySlug } from "@/lib/api/public-api";

/**
 * Tra danh mục theo slug trên URL, có thêm một nhịp dự phòng cho dữ liệu WP cũ:
 * bản migrate từng sinh danh mục trùng tên với hậu tố `-1`, nên khi slug gốc trả
 * 404 thì thử tiếp `{slug}-1` trước khi kết luận không tồn tại.
 *
 * Dùng chung cho `layout.tsx` (chốt chặn 404 / chuyển hướng, chạy TRƯỚC khung chờ
 * nên vẫn phát đúng mã trạng thái) và `page.tsx` (dựng nội dung). Cùng một lệnh
 * `fetch` nên Next gộp lại thành một lần gọi trong cùng lượt dựng trang.
 */
export async function getCategoryByRouteSlug(slug: string, locale: string) {
  const result = await getCategoryBySlug(slug, locale);
  if (result.data || result.error?.status !== 404 || slug.endsWith("-1")) {
    return result;
  }

  const legacyDuplicateResult = await getCategoryBySlug(`${slug}-1`, locale);
  return legacyDuplicateResult.data ? legacyDuplicateResult : result;
}
