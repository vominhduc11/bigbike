// Strip all migrated `.bb-header-search*` rules from globals.css.
// KEEP: `.bb-header-search-trigger.is-active` shared color group; `@keyframes
// bb-suggest-in`; the prefers-reduced-motion group (minus the layer member).
// Each block is removed by EXACT match with an assertion so a whitespace drift
// fails loudly instead of silently no-op'ing.
import fs from "node:fs";
const FILE = "app/globals.css";
let css = fs.readFileSync(FILE, "utf8");
const before = css.length;
let n = 0;

const crlf = (s) => s.replace(/\n/g, "\r\n"); // file is CRLF-only
function drop(block0, label) {
  const block = crlf(block0);
  if (!css.includes(block)) throw new Error("BLOCK NOT FOUND: " + label);
  const count = css.split(block).length - 1;
  if (count !== 1) throw new Error(`BLOCK NOT UNIQUE (${count}): ` + label);
  css = css.replace(block, "");
  n++;
}
function replace(from0, to0, label) {
  const from = crlf(from0), to = crlf(to0);
  if (!css.includes(from)) throw new Error("REPLACE-FROM NOT FOUND: " + label);
  css = css.replace(from, to);
}

// ── base section ─────────────────────────────────────────────────────────────
drop(`.bb-header-search {
  position: relative;
}

`, "base .bb-header-search");

drop(`.bb-header-search-layer {
  pointer-events: none;
  opacity: 0;
  visibility: hidden;
  transition: opacity 0.3s ease, visibility 0s linear 0.3s;
}

`, "base layer");

drop(`.bb-header-search-layer::before {
  content: "";
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: var(--bb-header-height);
  background: #000000;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: var(--bb-z-modal);
}

`, "base layer::before");

drop(`.bb-header-search-layer.is-open {
  pointer-events: auto;
  opacity: 1;
  visibility: visible;
  transition: opacity 0.3s ease, visibility 0s linear 0s;
}

`, "base layer.is-open");

// trim the reduced-motion group: drop only the layer member, keep info-sheet + mobile-panel
replace(`@media (prefers-reduced-motion: reduce) {
  .bb-header-search-layer,
  .bb-header-info-sheet,
  .bb-mobile-header-panel {
    transition-duration: 1ms !important;
  }
}`, `@media (prefers-reduced-motion: reduce) {
  .bb-header-info-sheet,
  .bb-mobile-header-panel {
    transition-duration: 1ms !important;
  }
}`, "rm group trim");

drop(`.bb-header-search-layer.is-open::before {
  opacity: 1;
}

`, "base layer.is-open::before");

drop(`.bb-header-search-overlay {
  position: fixed;
  inset: 0;
  border: none;
  background: rgba(0, 0, 0, 0.64);
}

`, "base overlay");

drop(`.bb-header-search-panel {
  position: fixed;
  top: 0;
  left: 50%;
  z-index: calc(var(--bb-z-modal) + 1);
  width: min(calc(100vw - 24px), 770px);
  height: var(--bb-header-height);
  padding: 0 40px;
  transform: translateX(-50%);
}

`, "base panel");

drop(`.bb-header-search-form {
  position: relative;
  display: flex;
  align-items: center;
  height: 100%;
}

`, "base form");

drop(`.bb-header-search-icon,
.bb-header-search-close {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  color: #ffffff;
}

`, "base icon/close shared");

drop(`.bb-header-search-icon {
  left: 0;
  margin-top: 3px;
}

`, "base icon");

drop(`.bb-header-search-input {
  height: 100%;
  border: none !important;
  background: transparent !important;
  padding: 0 48px 0 34px !important;
  box-shadow: none !important;
  color: #ffffff !important;
  font-size: 24px !important;
  font-weight: 400 !important;
}

`, "base input");

drop(`.bb-header-search-input::placeholder {
  color: #ffffff;
  opacity: 1;
  font-weight: 400;
}

`, "base input placeholder");

drop(`.bb-header-search-input:focus-visible {
  outline: none;
}

`, "base input focus-visible");

drop(`.bb-header-search-close {
  right: 0;
  min-height: 0 !important;
  padding: 0 !important;
}

`, "base close");

drop(`.bb-header-search-close:hover,
.bb-header-search-close:focus-visible {
  color: var(--bb-brand-primary);
  background: transparent !important;
}

`, "base close hover");

drop(`.bb-header-search-results {
  position: absolute;
  top: 100%;
  left: -40px;
  right: -40px;
  background: #ffffff;
  border-top: 2px solid var(--bb-brand-primary);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  z-index: 1;
  animation: bb-suggest-in 180ms var(--bb-ease-standard) both;
}

@media (prefers-reduced-motion: reduce) {
  .bb-header-search-results { animation: none; }
}

`, "base results + results rm");

// ── @media (max-width: 639px) — entire block (dead: overridden by ≤767 layers) ─
drop(`/* -- Responsive: WP header collapse rules ------------------ */
/* Desktop ≥ 1200px: nav visible. Mobile/tablet < 1200px: nav hidden via
   max-[1199px]:hidden in SiteHeader.tsx — no CSS rule needed here. */

@media (max-width: 639px) {
  .bb-header-search-panel {
    width: calc(100vw - 24px);
    padding-inline: 16px;
  }
  .bb-header-search-icon,
  .bb-header-search-close {
    display: none;
  }
  .bb-header-search-input {
    padding: 0 !important;
    font-size: 18px !important;
  }
}

`, "@639 dead block + comment");

// ── @media (max-width: 767px) full-screen transform block ──────────────────────
drop(`  .bb-header-search {
    position: static;
    order: 2;
    margin-left: auto;
  }

`, "767 .bb-header-search");

drop(`  .bb-header-search-layer::before {
    display: none;
  }

`, "767 layer::before display none");

drop(`  .bb-header-search-overlay {
    background: color-mix(in srgb, var(--bb-color-black) 72%, transparent);
  }

`, "767 overlay 72%");

drop(`  .bb-header-search-panel {
    top: 0;
    left: 0;
    display: flex;
    width: 100vw;
    height: 100dvh;
    padding: 0;
    flex-direction: column;
    background: var(--bb-mobile-shell-bg);
    color: var(--bb-text-inverse);
    transform: none;
  }

`, "767 panel");

drop(`  .bb-header-search-form {
    height: auto;
    min-height: calc(var(--bb-header-height) + env(safe-area-inset-top));
    padding: max(10px, env(safe-area-inset-top)) 12px 10px;
    gap: 8px;
    border-bottom: 1px solid var(--bb-mobile-shell-border);
    background: var(--bb-mobile-shell-surface-2);
  }

`, "767 form");

drop(`  .bb-header-search-icon,
  .bb-header-search-close {
    position: static;
    display: inline-flex;
    width: var(--bb-touch-target);
    height: var(--bb-touch-target);
    min-width: var(--bb-touch-target);
    align-items: center;
    justify-content: center;
    color: var(--bb-text-inverse);
    transform: none;
  }

`, "767 icon/close");

drop(`  .bb-header-search-input {
    height: var(--bb-touch-target) !important;
    border: 1px solid var(--bb-mobile-shell-border) !important;
    background: var(--bb-mobile-shell-surface) !important;
    padding: 0 12px !important;
    color: var(--bb-text-inverse) !important;
    font-size: 14px !important;
    line-height: 1 !important;
  }

`, "767 input");

drop(`  .bb-header-search-input::placeholder {
    color: var(--bb-text-inverse-muted);
  }

`, "767 input placeholder");

drop(`  .bb-header-search-close {
    right: auto;
    padding: 0 !important;
  }

`, "767 close");

// ── @media (max-width: 767px) light reskin block ───────────────────────────────
drop(`  .bb-header-search-layer {
    z-index: var(--bb-z-modal);
  }

`, "767 light layer z");

drop(`  .bb-header-search-overlay {
    background: color-mix(in srgb, var(--bb-color-black) 58%, transparent);
  }

`, "767 light overlay 58%");

drop(`  .bb-header-search-panel {
    background: var(--bb-bg-page);
    color: var(--bb-text-primary);
  }

`, "767 light panel");

drop(`  .bb-header-search-form {
    background: var(--bb-bg-surface-dark-2);
  }

`, "767 light form");

drop(`  .bb-header-search-input {
    border-color: rgba(255, 255, 255, 0.18) !important;
    background: var(--bb-bg-surface) !important;
    color: var(--bb-text-primary) !important;
  }

`, "767 light input");

drop(`  .bb-header-search-input::placeholder {
    color: var(--bb-text-secondary);
  }

`, "767 light input placeholder");

drop(`  .bb-header-search-icon,
  .bb-header-search-close {
    color: var(--bb-text-inverse);
  }

`, "767 light icon/close color");

// ── @media (max-width: 767px) panel-z + results-static block ───────────────────
drop(`  .bb-header-search-layer.is-open .bb-header-search-overlay {
    z-index: calc(var(--bb-mobile-panel-z) - 1);
  }

`, "767 z layer.is-open overlay");

drop(`  .bb-header-search-panel {
    z-index: var(--bb-mobile-panel-z);
    height: 100dvh;
    max-height: 100dvh;
    overflow: hidden;
    display: flex;
    flex-direction: column;
  }

`, "767 panel z");

drop(`  /* On mobile the autocomplete is part of the panel flow, not an absolute dropdown */
  .bb-header-search-results {
    position: static;
    left: auto;
    right: auto;
    flex: 1 1 auto;
    min-height: 0;
    border-top: 2px solid var(--bb-brand-primary);
    box-shadow: none;
    animation: none;
    border-radius: 0;
    max-height: none;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }

`, "767 results static");

drop(`  .bb-header-search-form {
    flex: 0 0 auto;
    min-height: calc(var(--bb-header-height) + env(safe-area-inset-top));
    padding: max(10px, env(safe-area-inset-top)) 14px 10px;
  }

`, "767 form flex");

drop(`  .bb-header-search-input {
    min-width: 0;
    font-size: 16px !important;
  }

`, "767 input min-width/fs");

drop(`  .bb-header-search-close,
  .bb-header-search-icon {
    min-height: var(--bb-touch-target);
  }

`, "767 close/icon min-height");

fs.writeFileSync(FILE, css);
console.log(`stripped ${n} blocks + 1 trim; ${before - css.length} bytes removed`);
