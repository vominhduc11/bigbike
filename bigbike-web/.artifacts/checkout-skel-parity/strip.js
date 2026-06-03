// CRLF-aware line-based splice: remove the checkout-skeleton bb-* CSS now that
// CheckoutSkeleton renders inline Tailwind. Keeps real-page .bb-checkout-page*
// chrome and the bb-breadcrumb/bb-page-head members of shared groups.
// Backs up to globals.css.bak; verifies brace balance + 0 residual class refs.
const fs = require("fs");
const PATH = "app/globals.css";
const raw = fs.readFileSync(PATH, "utf8");
fs.writeFileSync(PATH + ".bak", raw);
const lines = raw.split("\r\n");
const del = new Array(lines.length).fill(false);
const t = (i) => (lines[i] ?? "").trim();
function find(pred, from = 0) {
  for (let i = from; i < lines.length; i++) if (pred(i)) return i;
  return -1;
}
function need(idx, label) {
  if (idx < 0) throw new Error("NOT FOUND: " + label);
  return idx;
}
function markRange(a, b) { for (let i = a; i <= b; i++) del[i] = true; }

// A. base checkout block: comment .. .bb-order-summary h3 { ... }
const aStart = need(find((i) => t(i) === "/* -- Checkout page ---------------------------------------- */"), "A start");
const aEnd = need(find((i) => t(i).startsWith(".bb-order-summary h3 {"), aStart), "A end");
markRange(aStart, aEnd);

// B. .bb-checkout-layout { grid-template-columns: 1fr; }
del[need(find((i) => t(i) === ".bb-checkout-layout { grid-template-columns: 1fr; }"), "B")] = true;

// C. @media(max-width:768px){ .bb-order-summary { position: static; } }
const cMid = need(find((i) => t(i) === ".bb-order-summary { position: static; }"), "C mid");
if (t(cMid - 1) !== "@media (max-width: 768px) {" || t(cMid + 1) !== "}")
  throw new Error("C neighbors unexpected: [" + t(cMid - 1) + "] [" + t(cMid + 1) + "]");
markRange(cMid - 1, cMid + 1);

// D. drop only .bb-checkout-layout, from the ≤600 padding-inline:16px group
const dSel = need(find((i) => t(i) === ".bb-checkout-layout," && t(i + 1) === ".bb-account-layout { padding-inline: 16px; }"), "D");
del[dSel] = true;

// E. stepper ≤600 @media block (incl its comment header)
const eStart = need(find((i) => t(i) === "/* -- Stepper checkout horizontal scroll on phones ---------- */"), "E start");
if (t(eStart + 1) !== "@media (max-width: 600px) {") throw new Error("E media start unexpected: " + t(eStart + 1));
let depth = 0, eEnd = -1;
for (let i = eStart + 1; i < lines.length; i++) {
  depth += (lines[i].match(/{/g) || []).length - (lines[i].match(/}/g) || []).length;
  if (depth === 0) { eEnd = i; break; }
}
need(eEnd, "E end");
markRange(eStart, eEnd);

// F. drop dead member from the round-shape :is() group (substring edit, not delete)
const fIdx = need(find((i) => lines[i].includes(".bb-checkout-step-title h3 span")), "F");
lines[fIdx] = lines[fIdx].replace(".bb-checkout-step-title h3 span, ", "");

// G. drop .bb-checkout-section,/.bb-order-summary, from the ≤767 card border group
const gSel = need(find((i) => t(i) === ".bb-checkout-section," && t(i + 1) === ".bb-order-summary," && t(i + 2) === ".bb-order-card {"), "G");
del[gSel] = true; del[gSel + 1] = true;

// H. ≤767 checkout overrides block (.bb-checkout-layout gap:14 .. h3 font-size:15px })
const hStart = need(find((i) => t(i) === ".bb-checkout-layout {" && t(i + 1) === "gap: 14px;"), "H start");
const hFont = need(find((i) => t(i) === "font-size: 15px;", hStart), "H font");
if (t(hFont + 1) !== "}") throw new Error("H end unexpected: " + t(hFont + 1));
let hLead = hStart;
if (t(hStart - 1) === "") hLead = hStart - 1; // swallow one leading blank
markRange(hLead, hFont + 1);

// I. drop .bb-checkout-layout, from each large-desktop Tier-3 group (3 occurrences)
let iCount = 0;
for (let i = 0; i < lines.length; i++) {
  if (t(i) === ".bb-checkout-layout," && t(i + 1) === ".bb-breadcrumb," && t(i + 2) === ".bb-page-head {") {
    del[i] = true; iCount++;
  }
}
if (iCount !== 3) throw new Error("I expected 3 Tier-3 groups, found " + iCount);

const out = lines.filter((_, i) => !del[i]).join("\r\n");

// checks
const open = (out.match(/{/g) || []).length, close = (out.match(/}/g) || []).length;
if (open !== close) throw new Error(`BRACE IMBALANCE: { ${open} } ${close}`);
const residual = [".bb-checkout-layout", ".bb-stepper", ".bb-step ", ".bb-step.", ".bb-step,", ".bb-step:", "bb-checkout-section", "bb-order-summary", "bb-checkout-step-title"]
  .map((s) => [s, (out.split(s).length - 1)]).filter(([, n]) => n > 0);
console.log("removed lines:", del.filter(Boolean).length, "| Tier-3 groups:", iCount);
console.log("braces:", open, "==", close, "OK");
console.log("residual refs:", residual.length ? JSON.stringify(residual) : "none");
fs.writeFileSync(PATH, out);
console.log("new line count:", out.split("\r\n").length, "(was", lines.length, ")");
