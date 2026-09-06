import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import "../globals.css";
import { ClientIntlProvider } from "@/components/providers/ClientIntlProvider";
import { isLocale, LOCALES, type Locale } from "@/i18n/locale";
import { CartProvider } from "@/lib/cart-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { HeaderUiProvider } from "@/components/layout/HeaderUiContext";
import { AltSlugProvider } from "@/components/i18n/AltSlugProvider";
import { getSiteOrigin } from "@/lib/utils/routes";
import { env } from "@/env";

const FAVICON_BASE = "/brand/favicon";
const absoluteAssetUrl = (path: string) => new URL(path, getSiteOrigin()).toString();

const sharedMetadata: Omit<Metadata, "title" | "description"> = {
  // Phải dùng CHUNG nguồn với canonical (lib/utils/routes.ts → NEXT_PUBLIC_SITE_URL,
  // fallback https://bigbike.vn). Đóng cứng bigbike.vn ở đây làm OG image và canonical
  // trỏ hai nơi khác nhau khi build thiếu biến môi trường — Dockerfile:26 mặc định
  // NEXT_PUBLIC_SITE_URL=http://localhost:3000 và biến này được nhúng lúc build.
  metadataBase: new URL(getSiteOrigin()),
  icons: {
    icon: [
      {
        url: absoluteAssetUrl(`${FAVICON_BASE}/favicon-16x16.png`),
        sizes: "16x16",
        type: "image/png",
      },
      {
        url: absoluteAssetUrl(`${FAVICON_BASE}/favicon-32x32.png`),
        sizes: "32x32",
        type: "image/png",
      },
      {
        url: absoluteAssetUrl(`${FAVICON_BASE}/favicon-96x96.png`),
        sizes: "96x96",
        type: "image/png",
      },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/favicon.ico`), rel: "shortcut icon" },
    ],
    apple: [
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-57x57.png`), sizes: "57x57" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-60x60.png`), sizes: "60x60" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-72x72.png`), sizes: "72x72" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-76x76.png`), sizes: "76x76" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-114x114.png`), sizes: "114x114" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-120x120.png`), sizes: "120x120" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-144x144.png`), sizes: "144x144" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-152x152.png`), sizes: "152x152" },
      { url: absoluteAssetUrl(`${FAVICON_BASE}/apple-icon-180x180.png`), sizes: "180x180" },
    ],
    other: [
      { rel: "manifest", url: absoluteAssetUrl(`${FAVICON_BASE}/manifest.json`) },
      { rel: "msapplication-config", url: absoluteAssetUrl(`${FAVICON_BASE}/browserconfig.xml`) },
    ],
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return { robots: { index: false, follow: false } };
  const t = await getTranslations({ locale, namespace: "Common" });
  return {
    ...sharedMetadata,
    title: { default: t("siteTitle"), template: "%s | BigBike" },
    description: t("siteDescription"),
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
};

const GA4_ID = env.NEXT_PUBLIC_GA4_MEASUREMENT_ID;

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) notFound();
  const locale: Locale = localeParam;
  setRequestLocale(locale);
  const messages = await getMessages({ locale });
  return (
    <html lang={locale} className="h-full antialiased">
      <body className="bb-theme min-h-full flex flex-col pt-0!">
        {GA4_ID && (
          <>
            {/*
              The single Google Analytics 4 install of the storefront. A second one anywhere
              would double every number the property reports, revenue included.
              `window.gtag` must be defined here and not by a helper: gtag pushes its own
              `arguments` object onto the dataLayer, which a plain array push cannot emulate.
              Page views — including client-side navigation — are recorded by GA4's Enhanced
              Measurement, so the storefront never fires `page_view` itself.
            */}
            <Script
              id="ga4-init"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `window.dataLayer=window.dataLayer||[];function gtag(){window.dataLayer.push(arguments);}window.gtag=gtag;gtag('js',new Date());gtag('config','${GA4_ID}');`,
              }}
            />
            <Script
              id="ga4-src"
              strategy="afterInteractive"
              src={`https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`}
            />
          </>
        )}
        <ClientIntlProvider locale={locale} messages={messages}>
          <QueryProvider>
            <HeaderUiProvider>
              <CartProvider>
                <AltSlugProvider>{children}</AltSlugProvider>
              </CartProvider>
            </HeaderUiProvider>
          </QueryProvider>
        </ClientIntlProvider>
      </body>
    </html>
  );
}

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}
