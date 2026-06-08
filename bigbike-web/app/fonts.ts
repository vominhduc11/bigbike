import { Barlow, Barlow_Condensed } from "next/font/google";

export const fontBarlowCondensed = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

export const fontBarlow = Barlow({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-barlow",
  display: "swap",
});
