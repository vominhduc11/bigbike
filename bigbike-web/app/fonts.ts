// Typography — source of truth: bigbike-web/docs/TYPOGRAPHY.md (superfamily Barlow).
//
// next/font tự self-host webfont (không gọi runtime tới Google), preload và sinh
// fallback đã hiệu chỉnh metric để chống layout shift (CLS). Barlow và Barlow
// Condensed là font tĩnh nên BẮT BUỘC khai báo weight. Subset `vietnamese` cho
// dấu thanh đầy đủ. Chỉ nạp đúng weight thực dùng — không nạp dư.
import { Barlow, Barlow_Condensed } from "next/font/google";

// Body / nội dung / UI text — Barlow (grotesque trung tính, dễ đọc).
// 400 body · 500 medium · 600 strong/semibold · 700 bold.
export const barlow = Barlow({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-barlow",
});

// Display / heading / nav / button / label — Barlow Condensed (dùng kèm UPPERCASE).
// 500 footer slogan · 600 heading/nav/CTA · 700 h1/h2/display.
export const barlowCondensed = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--font-barlow-condensed",
});
