import { getRequestConfig } from "next-intl/server";
import { DEFAULT_TIME_ZONE, isLocale } from "./locale";

/**
 * Server render tĩnh theo locale — mặc định `vi`, KHÔNG đọc cookie/header ở tầng
 * này (đọc cookie sẽ ép mọi route thành dynamic/SSR, mất ISR/SSG).
 *
 * Route Sản phẩm/Danh mục/Bài viết tiếng Anh thật (`app/products/[slug]`,
 * `app/categories/[slug]`, `app/news/[slug]`) tự truyền `{ locale: "en" }` tường
 * minh vào từng lời gọi `getTranslations`/`getFormatter` — giá trị đó đi thẳng vào
 * tham số `locale` bên dưới mà KHÔNG cần đọc `requestLocale` (next-intl chỉ resolve
 * `requestLocale` qua `next/headers` khi callback này thực sự đọc nó — cố tình
 * KHÔNG destructure `requestLocale` ở đây để mọi route khác không vô tình bị ép
 * dynamic). Mọi route còn lại (không truyền `locale` tường minh) tiếp tục nhận
 * `vi` như trước — hành vi không đổi.
 *
 * Nội dung dữ liệu EN vốn fallback về VI field-by-field (PRODUCT_RULE_001/002).
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const resolved = isLocale(requested) ? requested : "vi";
  return {
    locale: resolved,
    timeZone: DEFAULT_TIME_ZONE,
    messages: (await import(`../messages/${resolved}.json`)).default,
  };
});
