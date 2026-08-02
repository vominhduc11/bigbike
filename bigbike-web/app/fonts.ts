import { Barlow, Barlow_Condensed } from "next/font/google";

export const fontBarlow = Barlow({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
  variable: "--font-brand-barlow",
  display: "swap",
});

// Canonical B groups use Barlow Condensed through --font-cta / --bb-font-cta.
// Only weights used by the current codebase are loaded.
export const fontBarlowCondensed = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

