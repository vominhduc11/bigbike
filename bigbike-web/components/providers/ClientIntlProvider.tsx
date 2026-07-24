"use client";

import { NextIntlClientProvider } from "next-intl";
import { usePathname } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ComponentProps } from "react";
import { DEFAULT_LOCALE, DEFAULT_TIME_ZONE, LOCALE_COOKIE, resolveLocale, type Locale } from "@/i18n/locale";

/** Kiểu message khớp đúng prop của NextIntlClientProvider (tránh phụ thuộc tên type export). */
type IntlMessages = ComponentProps<typeof NextIntlClientProvider>["messages"];

/**
 * i18n phía CLIENT — cho phép server render tĩnh bằng `vi` (xem i18n/request.ts) mà vẫn
 * đổi sang `en` được mà không cần round-trip server (giữ kiến trúc no-SSR / ISR).
 *
 * - Server truyền sẵn message `vi` (initialMessages) → render khớp, không hydration mismatch,
 *   TRỪ 3 prefix EN-only (`/products/`, `/categories/`, `/news/` — trang tiếng Anh thật, xem
 *   `isEnOnlyPath` bên dưới) nơi state khởi tạo thẳng `en` để khớp nội dung sản phẩm/danh
 *   mục/bài viết đã server-render bằng tiếng Anh ngay trong trang.
 * - Sau khi mount VÀ mỗi khi pathname đổi (kể cả điều hướng SPA), đọc lại: vào 3 prefix
 *   EN-only → ép `en`; ngoài ra theo cookie NEXT_LOCALE như trước.
 * - LanguageSwitcher gọi `useSetLocale()` để đổi ngôn ngữ: ghi cookie + nạp message ngay ở
 *   client, không reload, không router.refresh().
 */

type SetLocale = (locale: Locale) => void;

const SetLocaleContext = createContext<SetLocale>(() => {});

/** Đổi ngôn ngữ ở client (ghi cookie + swap message). Dùng trong LanguageSwitcher. */
export function useSetLocale(): SetLocale {
  return useContext(SetLocaleContext);
}

const ApplyPreviewLocaleContext = createContext<SetLocale>(() => {});

/**
 * Đổi ngôn ngữ CHỈ trong bộ nhớ (swap message, KHÔNG ghi cookie NEXT_LOCALE) — dùng
 * riêng cho khung xem trước sản phẩm/bài viết (`app/preview/*`), nơi cookie dùng
 * chung toàn origin/mọi tab nên không được đổi theo lựa chọn VI/EN của admin (sẽ
 * rò sang tab thật của khách đang mở cùng trình duyệt). An toàn vì mỗi iframe
 * preview đã là một browsing context riêng — chỉ cần không đụng `document.cookie`.
 */
export function useApplyPreviewLocale(): SetLocale {
  return useContext(ApplyPreviewLocaleContext);
}

function readLocaleCookie(): Locale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  return resolveLocale(match?.split("=")[1]);
}

async function loadMessages(locale: Locale): Promise<IntlMessages> {
  const mod = await import(`../../messages/${locale}.json`);
  return mod.default as IntlMessages;
}

// 3 route family này có trang tiếng Anh THẬT (server-render riêng, xem
// app/products|categories|news/[slug]/page.tsx) — khung giao diện (Header/Footer,
// LText/Tr trong nội dung trang) phải tự chuyển sang tiếng Anh theo URL, không phụ
// thuộc cookie NEXT_LOCALE (khách có thể chưa từng đổi cookie mà vẫn vào thẳng URL
// này qua Google/link chia sẻ).
const EN_ONLY_PREFIXES = ["/products/", "/categories/", "/news/"];

function isEnOnlyPath(pathname: string | null): boolean {
  if (!pathname) return false;
  return EN_ONLY_PREFIXES.some((prefix) => pathname === prefix.slice(0, -1) || pathname.startsWith(prefix));
}

export function ClientIntlProvider({
  initialMessages,
  enMessages,
  children,
}: {
  initialMessages: IntlMessages;
  enMessages: IntlMessages;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  // 3 prefix EN-only là 1 giá trị SUY RA thẳng từ pathname mỗi lần render — không
  // lưu vào state/effect. Nhờ vậy nó đúng ngay ở lượt render đầu tiên (kể cả pass
  // server tạo HTML ban đầu, vì usePathname() đã biết route thật lúc đó) lẫn mọi
  // lần điều hướng SPA sau này, không có khoảng trễ 1 lượt render nào cần effect
  // "đuổi theo" — tránh luôn lỗi lint set-state-in-effect (setState đồng bộ trong
  // effect gây render dây chuyền) mà không phải trì hoãn giả tạo qua promise.
  const forceEn = isEnOnlyPath(pathname);

  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<IntlMessages>(initialMessages);
  const [enCache, setEnCache] = useState<IntlMessages | null>(null);

  const effectiveLocale = forceEn ? "en" : locale;
  const effectiveMessages = forceEn ? enMessages : messages;

  if (typeof globalThis !== "undefined") {
    // eslint-disable-next-line react-hooks/immutability -- setting global locale for client-side routing parity during render
    globalThis.__NEXT_LOCALE__ = effectiveLocale;
  }

  const applyLocale = useCallback(
    async (next: Locale) => {
      if (next === DEFAULT_LOCALE) {
        setMessages(initialMessages);
        setLocaleState(DEFAULT_LOCALE);
        return;
      }
      const loaded = enCache ?? (await loadMessages(next));
      if (!enCache) setEnCache(loaded);
      setMessages(loaded);
      setLocaleState(next);
    },
    [enCache, initialMessages],
  );

  // Chỉ còn lo phần KHÔNG suy ra được từ pathname: cookie NEXT_LOCALE cho các route
  // ngoài 3 prefix EN-only (forceEn đã xử lý xong ở trên, thuần render, không cần
  // effect). Chạy lại mỗi khi rời/vào lại vùng "route thường" để không giữ state cũ
  // từ trước khi điều hướng. Bỏ qua trên /preview/* — route đó tự đổi locale qua
  // `useApplyPreviewLocale()` theo postMessage của admin, đọc cookie ở đây có thể
  // "thắng" race và đè locale preview về cookie cũ của khách thật.
  useEffect(() => {
    if (pathname?.startsWith("/preview")) return;
    if (forceEn) return;

    const cookieLocale = readLocaleCookie();
    if (cookieLocale === DEFAULT_LOCALE) return;
    let cancelled = false;
    void loadMessages(cookieLocale).then((loaded) => {
      if (cancelled) return;
      setEnCache(loaded);
      setMessages(loaded);
      setLocaleState(cookieLocale);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname, forceEn]);

  const setLocale = useCallback<SetLocale>(
    (next) => {
      document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      void applyLocale(next);
    },
    [applyLocale],
  );

  const value = useMemo(() => setLocale, [setLocale]);
  const applyPreviewValue = useMemo(() => applyLocale, [applyLocale]);

  return (
    <SetLocaleContext.Provider value={value}>
      <ApplyPreviewLocaleContext.Provider value={applyPreviewValue}>
        <NextIntlClientProvider locale={effectiveLocale} messages={effectiveMessages} timeZone={DEFAULT_TIME_ZONE}>
          {children}
        </NextIntlClientProvider>
      </ApplyPreviewLocaleContext.Provider>
    </SetLocaleContext.Provider>
  );
}
