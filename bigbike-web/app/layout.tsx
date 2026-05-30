import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { barlow, barlowCondensed } from "./fonts";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "./globals.css";
import "./home-news-parity.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { FloatingChatLoader } from "@/components/layout/FloatingChatLoader";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { MobileCartSheet } from "@/components/layout/MobileCartSheet";
import { CartProvider } from "@/lib/cart-context";
import { WishlistProvider } from "@/lib/wishlist-context";
import { CompareProvider } from "@/lib/compare-context";
import { CompareBar } from "@/components/catalog/CompareBar";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { HeaderUiProvider } from "@/components/layout/HeaderUiContext";
import { env } from "@/env";

export const metadata: Metadata = {
  metadataBase: new URL("https://bigbike.vn"),
  title: {
    default: "BigBike - Đồ Bảo Hộ Biker",
    template: "%s | BigBike",
  },
  description:
    "BigBike — chuyên đồ bảo hộ biker, gear touring, mũ bảo hiểm, áo giáp, găng tay và phụ kiện rider chính hãng.",
};

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

const GTM_ID = env.NEXT_PUBLIC_GTM_ID;

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} className={`${barlow.variable} ${barlowCondensed.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="bb-theme min-h-full flex flex-col" suppressHydrationWarning>
        {GTM_ID && (
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
        )}
        {GTM_ID && (
          <noscript>
            <iframe
              src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
              height="0"
              width="0"
              style={{ display: "none", visibility: "hidden" }}
              title="GTM"
            />
          </noscript>
        )}
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <HeaderUiProvider>
              <CartProvider>
                <WishlistProvider>
                  <CompareProvider>
                    <SiteHeader />
                    <main className="bb-main pb-16 md:pb-0">{children}</main>
                    <div className="block md:hidden">
                      <MobileBottomNav />
                    </div>
                    <MobileCartSheet />
                    <SiteFooter />
                    <CompareBar />
                    <div className="bb-floating-chat-anchor fixed bottom-[max(80px,calc(env(safe-area-inset-bottom)+80px))] md:bottom-[max(24px,env(safe-area-inset-bottom))] right-[max(20px,env(safe-area-inset-right))] md:right-[max(24px,env(safe-area-inset-right))] pointer-events-none [&>*]:pointer-events-auto [[data-scroll-locked]_&]:hidden">
                      <FloatingChatLoader />
                    </div>
                  </CompareProvider>
                </WishlistProvider>
              </CartProvider>
            </HeaderUiProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
