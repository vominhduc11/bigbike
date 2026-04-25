import type { Metadata } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";

const bungee = localFont({
  src: "../public/fonts/Bungee-Regular.ttf",
  variable: "--font-bungee",
  weight: "400",
  display: "swap",
});

const exo = localFont({
  src: [
    { path: "../public/fonts/Exo-Thin.ttf", weight: "100", style: "normal" },
    { path: "../public/fonts/Exo-Light.ttf", weight: "300", style: "normal" },
    { path: "../public/fonts/Exo-Regular.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Exo-Italic.ttf", weight: "400", style: "italic" },
    { path: "../public/fonts/Exo-Medium.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/Exo-MediumItalic.ttf", weight: "500", style: "italic" },
    { path: "../public/fonts/Exo-SemiBold.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/Exo-Bold.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/Exo-BoldItalic.ttf", weight: "700", style: "italic" },
    { path: "../public/fonts/Exo-Black.ttf", weight: "900", style: "normal" },
    { path: "../public/fonts/Exo-BlackItalic.ttf", weight: "900", style: "italic" },
  ],
  variable: "--font-exo",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bigbike.vn"),
  title: {
    default: "BigBike - Đồ Bảo Hộ Biker",
    template: "%s | BigBike",
  },
  description:
    "BigBike — chuyên đồ bảo hộ biker, gear touring, mũ bảo hiểm, áo giáp, găng tay và phụ kiện rider chính hãng.",
  alternates: {
    canonical: "https://bigbike.vn/",
  },
};

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${bungee.variable} ${exo.variable} h-full antialiased`}>
      <head>
        {GTM_ID && (
          <Script
            id="gtm-init"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
            }}
          />
        )}
      </head>
      <body className="bb-theme-dark min-h-full flex flex-col">
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
        <SiteHeader />
        <main className="bb-main">{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
