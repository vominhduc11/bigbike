import { Barlow_Condensed } from "next/font/google";

// Barlow Condensed (--font-cta / --bb-font-cta) backs 18+ CSS rules across globals.css/
// brand-tokens.css (nav, CTA, badges, kickers...) — left at all 4 weights; auditing every
// rule's actual font-weight to safely narrow this set is a separate, larger pass.
export const fontBarlowCondensed = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

