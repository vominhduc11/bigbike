"use client";

import { NextIntlClientProvider } from "next-intl";
import { usePathname } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useState,
  type ComponentProps,
} from "react";

import { DEFAULT_TIME_ZONE, type Locale } from "@/i18n/locale";

type IntlMessages = ComponentProps<typeof NextIntlClientProvider>["messages"];
type SetLocale = (locale: Locale) => void;

const ApplyPreviewLocaleContext = createContext<SetLocale>(() => {});

/** Preview is the only surface allowed to switch locale without changing its URL. */
export function useApplyPreviewLocale(): SetLocale {
  return useContext(ApplyPreviewLocaleContext);
}

/** @deprecated Storefront locale changes must navigate to the localized URL. */
export function useSetLocale(): SetLocale {
  return () => {};
}

export function ClientIntlProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale;
  messages: IntlMessages;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isPreview = pathname?.startsWith("/preview/") ?? false;
  const [previewState, setPreviewState] = useState<{
    locale: Locale;
    messages: IntlMessages;
  } | null>(null);

  const applyPreviewLocale = useCallback<SetLocale>(
    (nextLocale) => {
      if (!isPreview) return;
      void import(`../../messages/${nextLocale}.json`).then((module) => {
        setPreviewState({ locale: nextLocale, messages: module.default as IntlMessages });
      });
    },
    [isPreview],
  );

  const effective = isPreview && previewState ? previewState : { locale, messages };

  return (
    <ApplyPreviewLocaleContext.Provider value={applyPreviewLocale}>
      <NextIntlClientProvider
        locale={effective.locale}
        messages={effective.messages}
        timeZone={DEFAULT_TIME_ZONE}
      >
        {children}
      </NextIntlClientProvider>
    </ApplyPreviewLocaleContext.Provider>
  );
}
