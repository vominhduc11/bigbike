import type { Metadata } from "next";
import { Bungee, Exo_2 } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/layout/SiteHeader";

const bungee = Bungee({
  variable: "--font-bungee",
  weight: "400",
  subsets: ["latin", "vietnamese"],
});

const exo = Exo_2({
  variable: "--font-exo",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://bigbike.vn"),
  title: {
    default: "BigBike - Đồ Bảo Hộ Biker",
    template: "%s | BigBike",
  },
  description:
    "BigBike public catalog và content page cho helmet, jacket, phụ kiện rider theo route legacy đã chuẩn hoá.",
  alternates: {
    canonical: "https://bigbike.vn/",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className={`${bungee.variable} ${exo.variable} h-full antialiased`}>
      <body className="bb-theme-dark min-h-full flex flex-col">
        <SiteHeader />
        <main className="bb-main">{children}</main>
      </body>
    </html>
  );
}
