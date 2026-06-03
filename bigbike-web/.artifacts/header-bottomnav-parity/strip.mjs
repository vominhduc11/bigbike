// Strip bottom-nav leaf CSS (CRLF-aware, exact-rule-anchored). KEEP .bb-bottom-nav
// marker for the two parent-state slide-out rules (html[data-bb-header-panel] /
// body:has(.bb-pdp-sticky-cta.is-visible)).
import fs from "node:fs";
const f = "app/globals.css";
let t = fs.readFileSync(f, "utf8");
const before = t.length;
const EOL = t.includes("\r\n") ? "\r\n" : "\n";
const N = (s) => s.split("\n").join(EOL);

// rules followed by a blank line → remove rule + that trailing blank
const trailing = [
  `  .bb-bottom-nav {\n    border-color: var(--bb-mobile-shell-border);\n    color: var(--bb-text-inverse-muted);\n  }`,
  `  .bb-bottom-nav-item {\n    border: 0;\n    background: transparent;\n    font-family: var(--bb-font-body);\n    cursor: pointer;\n  }`,
  `  .bb-bottom-nav {\n    z-index: 650;\n    background: color-mix(in srgb, var(--bb-bg-surface-dark) 96%, transparent);\n    box-shadow: 0 -10px 24px rgba(0, 0, 0, 0.24);\n  }`,
  `  .bb-bottom-nav > div {\n    gap: 2px;\n    justify-content: space-between;\n    padding-inline: 4px;\n  }`,
  `  .bb-bottom-nav-item {\n    flex: 1 1 0;\n    min-width: 0;\n    min-height: 56px;\n    color: var(--bb-text-inverse-muted);\n    font-family: var(--bb-font-cta);\n    letter-spacing: 0;\n  }`,
  `  .bb-bottom-nav-item span {\n    max-width: 100%;\n    overflow: hidden;\n    text-overflow: ellipsis;\n    white-space: nowrap;\n  }`,
  `  .bb-bottom-nav {\n    background: var(--bb-bg-surface-dark);\n    border-color: var(--bb-mobile-shell-border);\n    color: var(--bb-text-inverse-muted);\n  }`,
  `  .bb-bottom-nav-item {\n    color: var(--bb-text-inverse-muted);\n  }`,
  `  .bb-bottom-nav-item.is-active {\n    color: var(--bb-brand-primary-on-dark);\n  }`,
  `  .bb-bottom-nav-item span {\n    color: inherit;\n  }`,
  `  .bb-bottom-nav-active-bar {\n    background: var(--bb-brand-primary-on-dark);\n  }`,
  `  .bb-bottom-nav {\n    z-index: 650;\n    transition:\n      opacity var(--bb-duration-normal) var(--bb-ease-standard),\n      transform var(--bb-duration-normal) var(--bb-ease-standard),\n      visibility var(--bb-duration-normal) var(--bb-ease-standard);\n  }`,
  `  .bb-bottom-nav > div {\n    padding-inline: 6px;\n  }`,
  `  .bb-bottom-nav-item {\n    min-height: 58px;\n    touch-action: manipulation;\n  }`,
];
// rule that is LAST in its @media block (followed by the closing brace) → remove the
// preceding blank line + rule instead
const leading = [
  `  .bb-bottom-nav-item span {\n    font-size: 10px;\n  }`,
];

for (const r of trailing) {
  const target = N(r) + EOL + EOL;
  const i = t.indexOf(target);
  if (i < 0) throw new Error("trailing not found: " + r.slice(0, 48));
  if (t.indexOf(target, i + 1) >= 0) throw new Error("AMBIGUOUS: " + r.slice(0, 48));
  t = t.slice(0, i) + t.slice(i + target.length);
}
for (const r of leading) {
  const target = EOL + EOL + N(r);
  const i = t.indexOf(target);
  if (i < 0) throw new Error("leading not found: " + r.slice(0, 48));
  if (t.indexOf(target, i + 1) >= 0) throw new Error("AMBIGUOUS: " + r.slice(0, 48));
  t = t.slice(0, i) + t.slice(i + target.length);
}

fs.writeFileSync(f, t);
console.log(`globals.css: ${before} -> ${t.length} bytes (-${before - t.length})`);
const ob = (t.match(/{/g) || []).length, cb = (t.match(/}/g) || []).length;
console.log(`braces: ${ob} open / ${cb} close ${ob === cb ? "OK" : "MISMATCH"}`);
console.log(`.bb-bottom-nav-item remaining: ${(t.match(/\.bb-bottom-nav-item/g) || []).length} (expect 0)`);
console.log(`.bb-bottom-nav-active-bar remaining: ${(t.match(/\.bb-bottom-nav-active-bar/g) || []).length} (expect 0)`);
console.log(`.bb-bottom-nav remaining: ${(t.match(/\.bb-bottom-nav(?![-\w])/g) || []).length} (expect 2: 2 parent-state rules)`);
