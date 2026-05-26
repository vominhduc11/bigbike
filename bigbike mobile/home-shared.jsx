// home-shared.jsx — Light-first WP-parity tokens, icons, placeholders.
// Per styles/brand-tokens.css + STYLEGUIDE.md:
//   - Page bg #fff, text black; only header/footer/drawers/bottom-nav are dark.
//   - Brand red #ff0c09 (price/CTA). Sale price uses red-700 #cc0906 (WCAG AA).
//   - Borders #dddddd (subtle), #cecece (default), #abb8c3 (strong).
//   - Fonts: Oswald (heading/display), Barlow (body/link), Barlow Condensed (CTA/nav/badge/price).
//   - Radius 0 everywhere except real circles. No emoji.

// ─────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────
const bbTokens = {
  // Light surfaces (body)
  bg:        "#ffffff",
  bgSection: "#ffffff",
  bgRaised:  "#f5f5f5",
  bgAlt:     "#f8f8f8",
  bgHover:   "#fff4f3",
  surface:   "#ffffff",
  surface2:  "#f5f5f5",

  // Dark surfaces (header, footer top, drawers, toasts, bottom-nav)
  dark:      "#141414",
  dark2:     "#0d0d0d",
  dark3:     "#111111",
  footerTop: "#3a3a3a",

  // Borders
  borderSubtle:  "#dddddd",
  border:        "#cecece",
  borderStrong:  "#abb8c3",
  borderBrand:   "rgba(255, 12, 9, 0.36)",

  // Text on light
  text:      "#000000",
  textSec:   "#6f6f6f",
  textMute:  "#abb8c3",

  // Text on dark
  textInv:        "#ffffff",
  textInvSec:     "#cecece",
  textInvMute:    "#abb8c3",

  // Brand
  brand:        "#ff0c09",
  brandHover:   "#e50a07",
  brandActive:  "#cc0906",
  brandSoft:    "rgba(255, 12, 9, 0.08)",
  brandSoftBg:  "#fff4f3",

  // Accent — secondary link/info color
  blue:         "#007bff",
  cyan:         "#00bfff",
  warn:         "#fcb900",
  ok:           "#3d5230",
  okBg:         "rgba(119, 136, 102, 0.14)",
  okBorder:     "rgba(119, 136, 102, 0.34)",
  discount:     "#6100d1",

  // Type
  fontDisplay: "'Oswald', 'Helvetica Neue', Arial, sans-serif",
  fontBody:    "'Barlow', 'Segoe UI', system-ui, sans-serif",
  fontCond:    "'Barlow Condensed', 'Barlow', sans-serif",
  fontMono:    "'JetBrains Mono', 'IBM Plex Mono', ui-monospace, monospace",

  // Shadows (WP parity — minimal)
  shadowProduct: "0 4px 12px rgba(255, 12, 9, 0.10)",
  shadowMd:      "0 3px 6px rgba(0, 0, 0, 0.16)",
  shadowLg:      "0 8px 24px rgba(0, 0, 0, 0.20)",

  // Layout
  touch: 44,
};

// Legacy aliases used by older sections (will resolve via tokens above)
bbTokens.bgAlt = bbTokens.bgAlt;
bbTokens.brandBorder = bbTokens.borderBrand;

// ─────────────────────────────────────────────────────────────
// Icons (24px stroke, currentColor) — lucide-style
// ─────────────────────────────────────────────────────────────
const I = {
  menu:    (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 7h18M3 12h18M3 17h12"/></svg>,
  search:  (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>,
  cart:    (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="20" r="1.4"/><circle cx="17" cy="20" r="1.4"/><path d="M3 4h2.4l1.6 12h11l2-8.5H7.2"/></svg>,
  user:    (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c.8-4.5 4.2-7 8-7s7.2 2.5 8 7"/></svg>,
  home:    (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/></svg>,
  grid:    (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  heart:   (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill={p.fill||"none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 21s-7-4.5-9.3-9.2C1.1 8.4 3 5 6.3 5c2 0 3.4 1 4.4 2.3l1.3 1.6 1.3-1.6C14.3 6 15.7 5 17.7 5 21 5 22.9 8.4 21.3 11.8 19 16.5 12 21 12 21z"/></svg>,
  chev:    (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 6 6 6-6 6"/></svg>,
  chevL:   (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 6-6 6 6 6"/></svg>,
  chevDown:(p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>,
  arrow:   (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 5l7 7-7 7"/></svg>,
  close:   (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M6 6l12 12M6 18 18 6"/></svg>,
  phone:   (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h4l2 5-2.5 1.5a12 12 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2z"/></svg>,
  mail:    (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="14"/><path d="m3 7 9 7 9-7"/></svg>,
  shield:  (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 4 6v6c0 4.5 3.2 8.3 8 9 4.8-.7 8-4.5 8-9V6l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>,
  truck:   (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7h11v9H2zM13 10h5l3 3v3h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>,
  rotate:  (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>,
  spark:   (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v4M12 17v4M3 12h4M17 12h4M5.6 5.6l2.8 2.8M15.6 15.6l2.8 2.8M5.6 18.4l2.8-2.8M15.6 8.4l2.8-2.8"/></svg>,
  headset: (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2" y="14" width="5" height="6" rx="1.5"/><rect x="17" y="14" width="5" height="6" rx="1.5"/><path d="M20 20a3 3 0 0 1-3 3h-3"/></svg>,
  star:    (p) => <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="currentColor"><path d="m12 3 2.6 5.5L20 9.3l-4 4 1 5.7L12 16.4 7 19l1-5.7-4-4 5.4-.8z"/></svg>,
  starO:   (p) => <svg viewBox="0 0 24 24" width={p.s||14} height={p.s||14} fill="none" stroke="currentColor" strokeWidth="1.6"><path d="m12 3 2.6 5.5L20 9.3l-4 4 1 5.7L12 16.4 7 19l1-5.7-4-4 5.4-.8z"/></svg>,
  bolt:    (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg>,
  plus:    (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>,
  trash:   (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14"/><path d="M10 11v6M14 11v6"/></svg>,
  edit:    (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h4l10-10-4-4L4 16v4z"/><path d="m14 6 4 4"/></svg>,
  pin:     (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s7-7 7-13a7 7 0 0 0-14 0c0 6 7 13 7 13z"/><circle cx="12" cy="9" r="2.5"/></svg>,
  check:   (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg>,
  eye:     (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  package: (p) => <svg viewBox="0 0 24 24" width={p.s||22} height={p.s||22} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 7 9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="m3 7 9 4 9-4"/></svg>,
  ticket:  (p) => <svg viewBox="0 0 24 24" width={p.s||16} height={p.s||16} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8v3a2 2 0 1 1 0 4v3h18v-3a2 2 0 1 1 0-4V8H3z"/><path d="M9 8v12M15 8v12" strokeDasharray="2 2"/></svg>,
  fb:      (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="currentColor"><path d="M13 22v-9h3l.5-4H13V6.5c0-1.1.3-1.9 2-1.9h2V1.1C16.7 1 15.6 1 14.4 1 11.9 1 10 2.5 10 5.4V9H7v4h3v9z"/></svg>,
  ig:      (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="18" height="18"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>,
  yt:      (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="currentColor"><path d="M22 12a30 30 0 0 0-.5-5.6 2.6 2.6 0 0 0-1.8-1.8C18 4 12 4 12 4s-6 0-7.7.6A2.6 2.6 0 0 0 2.5 6.4 30 30 0 0 0 2 12c0 1.9.1 3.8.5 5.6.3 1 1 1.6 1.8 1.8C6 20 12 20 12 20s6 0 7.7-.6c.9-.2 1.5-.8 1.8-1.8.4-1.8.5-3.7.5-5.6zM10 15V9l5 3z"/></svg>,
  tt:      (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="currentColor"><path d="M17 8.5a5.5 5.5 0 0 1-4-1.8V16a5 5 0 1 1-5-5v3a2 2 0 1 0 2 2V2h3a4 4 0 0 0 4 4z"/></svg>,
  zalo:    (p) => <svg viewBox="0 0 24 24" width={p.s||18} height={p.s||18} fill="currentColor"><circle cx="12" cy="12" r="10"/><text x="12" y="15" textAnchor="middle" fontSize="7" fill="#fff" fontFamily="sans-serif" fontWeight="700">Z</text></svg>,
  chat:    (p) => <svg viewBox="0 0 24 24" width={p.s||20} height={p.s||20} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a8 8 0 0 1-12 7l-5 1 1-5a8 8 0 1 1 16-3z"/></svg>,
};

// ─────────────────────────────────────────────────────────────
// Placeholder system — light cards on white background
// Subtle warm-grey stripes + monospace tag.
// ─────────────────────────────────────────────────────────────
function ProductPlaceholder({ tag = "", h = 200, tone = "light", aspect, style }) {
  const palettes = {
    light:  { bg: "#f5f5f5", stripe: "#eeeeef", text: "#6f6f6f" },
    light2: { bg: "#f8f8f8", stripe: "#eeeeef", text: "#6f6f6f" },
    chrome: { bg: "#eef0f2", stripe: "#e3e6ea", text: "#6f6f6f" },
    warm:   { bg: "#faf7f5", stripe: "#f0ebe7", text: "#6f6f6f" },
    dark:   { bg: "#1a1a1a", stripe: "rgba(255,255,255,0.06)", text: "#abb8c3" },
  };
  const p = palettes[tone] || palettes.light;
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: aspect ? undefined : h,
        aspectRatio: aspect,
        background: `repeating-linear-gradient(-35deg, ${p.bg} 0 14px, ${p.stripe} 14px 15px), ${p.bg}`,
        overflow: "hidden",
        ...style,
      }}
    >
      {tag && (
        <div style={{
          position: "absolute", top: 8, left: 8,
          fontFamily: bbTokens.fontMono, fontSize: 9,
          letterSpacing: "0.08em", color: p.text,
          background: "rgba(255,255,255,0.85)",
          padding: "3px 6px",
          textTransform: "uppercase",
        }}>{tag}</div>
      )}
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: bbTokens.fontMono, fontSize: 10,
        color: p.text, letterSpacing: "0.18em", opacity: 0.5,
      }}>IMG</div>
    </div>
  );
}

// Hero with WP-style overlay gradient (dark side panel)
function HeroPlaceholder({ tag = "RIDER / HERO", tint = "light" }) {
  const palette = tint === "dark"
    ? { bg: "#1a1a1a", stripe: "rgba(255,255,255,0.06)" }
    : { bg: "#f0eeec", stripe: "rgba(0,0,0,0.04)" };
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: `repeating-linear-gradient(-35deg, ${palette.bg} 0 18px, ${palette.stripe} 18px 19px), ${palette.bg}`,
    }}>
      <div style={{
        position: "absolute", top: 14, left: 14,
        fontFamily: bbTokens.fontMono, fontSize: 10,
        letterSpacing: "0.10em", color: tint === "dark" ? "#abb8c3" : "#6f6f6f",
        background: "rgba(255,255,255,0.85)",
        padding: "4px 7px",
        textTransform: "uppercase",
      }}>{tag}</div>
      <div style={{
        position: "absolute", inset: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: bbTokens.fontMono, fontSize: 11,
        color: tint === "dark" ? "#abb8c3" : "#6f6f6f",
        letterSpacing: "0.22em", opacity: 0.5,
      }}>{"// LIFESTYLE IMAGE //"}</div>
      {/* WP overlay gradient — dark left, transparent right — for hero text legibility */}
      <div style={{
        position: "absolute", inset: 0,
        background: "linear-gradient(90deg, rgba(0,0,0,0.78) 0%, rgba(0,0,0,0.42) 56%, rgba(0,0,0,0.18) 100%)",
        pointerEvents: "none",
      }} />
    </div>
  );
}

// Logo wordmark — "BIGBIKE" Oswald display, red dot
function BigBikeMark({ size = 18, color = "#fff", dot = bbTokens.brand }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 0,
      fontFamily: bbTokens.fontDisplay, fontWeight: 700, fontSize: size,
      letterSpacing: "0.04em", color, textTransform: "uppercase", lineHeight: 1,
    }}>
      BIGBIKE
      <span style={{
        display: "inline-block",
        width: Math.max(4, size * 0.22), height: Math.max(4, size * 0.22),
        borderRadius: "50%", background: dot,
        marginLeft: 3, marginBottom: -1,
      }} />
    </span>
  );
}

// VND price formatter — matches formatVnd from codebase
function vnd(n) {
  return n.toLocaleString("vi-VN") + "₫";
}

// Star rating row
function StarRow({ value = 5, size = 12, color }) {
  const filled = Math.floor(value);
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 1,
      color: color || bbTokens.warn,
    }}>
      {[1,2,3,4,5].map((i) => (
        i <= filled
          ? <I.star key={i} s={size} />
          : <I.starO key={i} s={size} />
      ))}
    </span>
  );
}

Object.assign(window, {
  bbTokens, BBI: I, ProductPlaceholder, HeroPlaceholder, BigBikeMark, vnd, StarRow,
});
