import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE } from "./locale";

/**
 * Server luôn render bằng locale canonical `vi` — KHÔNG đọc cookie ở tầng server.
 * Đọc cookie (next/headers) sẽ ép mọi route thành dynamic (SSR); để đạt kiến trúc
 * ISR/SSG, locale phải tĩnh ở server. Tiếng Anh được xử lý ở CLIENT qua
 * `ClientIntlProvider` (đọc cookie NEXT_LOCALE sau khi mount và nạp `messages/en.json`).
 *
 * Nội dung dữ liệu EN vốn fallback về VI field-by-field (PRODUCT_RULE_001/002), nên
 * bản server (vi) là bản SEO canonical; URL vẫn dùng chung mọi ngôn ngữ (PRODUCT_RULE_003).
 */
export default getRequestConfig(async () => {
  return {
    locale: DEFAULT_LOCALE,
    timeZone: DEFAULT_TIME_ZONE,
    messages: (await import(`../messages/${DEFAULT_LOCALE}.json`)).default,
  };
});
