/**
 * Canonical responsive matrix for the bigbike-web QA sweep. Aligned with the
 * STYLEGUIDE breakpoint policy
 * (sm640 / md768 / lg1024 / xl1280 / 2xl1536 / 3xl1920 / 4xl2560).
 */
export type ViewportKind = "mobile" | "tablet" | "desktop";

export type ViewportDef = {
  name: string;
  width: number;
  height: number;
  kind: ViewportKind;
};

export const VIEWPORTS: ViewportDef[] = [
  { name: "mobile-360x800", width: 360, height: 800, kind: "mobile" },
  { name: "mobile-375x812", width: 375, height: 812, kind: "mobile" },
  { name: "mobile-390x844", width: 390, height: 844, kind: "mobile" },
  { name: "mobile-430x932", width: 430, height: 932, kind: "mobile" },
  { name: "mobile-640x900", width: 640, height: 900, kind: "mobile" },
  { name: "tablet-768x1024", width: 768, height: 1024, kind: "tablet" },
  { name: "tablet-1024x768", width: 1024, height: 768, kind: "tablet" },
  { name: "desktop-1280x800", width: 1280, height: 800, kind: "desktop" },
  { name: "desktop-1440x900", width: 1440, height: 900, kind: "desktop" },
  { name: "desktop-1920x1080", width: 1920, height: 1080, kind: "desktop" },
  { name: "desktop-2560x1440", width: 2560, height: 1440, kind: "desktop" },
];

/** Representative mobile/desktop used for visual snapshots + effect specs. */
export const MOBILE: ViewportDef = VIEWPORTS.find((viewport) => viewport.name === "mobile-390x844")!;
export const DESKTOP: ViewportDef = VIEWPORTS.find((viewport) => viewport.name === "desktop-1440x900")!;
