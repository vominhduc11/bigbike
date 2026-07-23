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
 * - Server truyền sẵn message `vi` (initialMessages) → render khớp, không hydration mismatch.
 * - Sau khi mount, đọc cookie NEXT_LOCALE; nếu `en` thì nạp `messages/en.json` và đổi state.
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

export function ClientIntlProvider({
  initialMessages,
  children,
}: {
  initialMessages: IntlMessages;
  children: React.ReactNode;
}) {
  // Khởi tạo bằng vi (khớp server) — tránh hydration mismatch.
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);
  const [messages, setMessages] = useState<IntlMessages>(initialMessages);
  const [enCache, setEnCache] = useState<IntlMessages | null>(null);

  if (typeof globalThis !== "undefined") {
    // eslint-disable-next-line react-hooks/immutability -- setting global locale for client-side routing parity during render
    globalThis.__NEXT_LOCALE__ = locale;
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

  // Sau mount: nếu cookie là en (visitor đã chọn từ trước) thì nạp + swap sang en.
  // Mọi setState nằm trong callback async (.then) — đồng bộ với hệ ngoài (cookie),
  // không phải setState đồng bộ trong thân effect. Bỏ qua trên /preview/* — route đó
  // tự đổi locale qua `useApplyPreviewLocale()` theo postMessage của admin, đọc cookie
  // ở đây có thể "thắng" race và đè locale preview về cookie cũ của khách thật.
  const pathname = usePathname();
  useEffect(() => {
    if (pathname?.startsWith("/preview")) return;
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
  }, [pathname]);

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
        <NextIntlClientProvider locale={locale} messages={messages} timeZone={DEFAULT_TIME_ZONE}>
          {children}
        </NextIntlClientProvider>
      </ApplyPreviewLocaleContext.Provider>
    </SetLocaleContext.Provider>
  );
}
