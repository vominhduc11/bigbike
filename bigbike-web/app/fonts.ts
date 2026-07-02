import { Barlow, Barlow_Condensed } from "next/font/google";

// Barlow Condensed (--font-cta / --bb-font-cta) backs 18+ CSS rules across globals.css/
// brand-tokens.css (nav, CTA, badges, kickers...) — left at all 4 weights; auditing every
// rule's actual font-weight to safely narrow this set is a separate, larger pass.
export const fontBarlowCondensed = Barlow_Condensed({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600", "700", "900"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

// Plain Barlow (--font-barlow) only backs `font-barlow` Tailwind usages — grep-verified:
// 600 (font-semibold) at ProductLocalizedParts.tsx / ProductTrustCard.tsx / WpCategorySidebar.tsx.
// 700 was only reachable via lib/ui-classes.ts's `sectionEyebrow`, which nothing imports (dead),
// and 900 (font-black) has zero occurrences anywhere in the codebase — dropped both; every page
// preloads 2 fewer font files per subset (4 fewer requests total) with no visual change.
export const fontBarlow = Barlow({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600"],
  variable: "--font-barlow",
  display: "swap",
});
