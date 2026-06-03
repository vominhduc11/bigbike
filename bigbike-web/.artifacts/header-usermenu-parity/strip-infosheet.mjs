// Commit 2 — strip info-sheet base CSS from globals.css (CRLF-aware, content-anchored).
// KEEP: line ~840 reduced-motion group (.bb-header-info-sheet marker), the
// body:has(.bb-article-detail-page) context rules, and the <=767 info-trigger hide.
import fs from "node:fs";
const f = "app/globals.css";
let t = fs.readFileSync(f, "utf8");
const before = t.length;

// Remove the .bb-header-info-sheet base + .is-open + overlay + content block,
// stopping at the next rule (.bb-account-avatar). The 838 group uses
// ".bb-header-info-sheet," (comma) and the context rules use "body:has(...)" — neither
// matches the bare ".bb-header-info-sheet {" base selector, so only the block is hit.
const start = t.indexOf(".bb-header-info-sheet {");
const end = t.indexOf(".bb-account-avatar {");
if (start < 0 || end < 0 || end < start) throw new Error("block markers not found");
t = t.slice(0, start) + t.slice(end);

fs.writeFileSync(f, t);
console.log(`globals.css: ${before} -> ${t.length} bytes (-${before - t.length})`);

const ob = (t.match(/{/g) || []).length, cb = (t.match(/}/g) || []).length;
console.log(`braces: ${ob} open / ${cb} close ${ob === cb ? "OK" : "MISMATCH"}`);

// residual checks
const overlayCount = (t.match(/\.bb-header-info-overlay/g) || []).length;
console.log(`.bb-header-info-overlay refs remaining: ${overlayCount} (expect 0)`);
console.log(`.bb-header-info-sheet { base remaining: ${t.includes(".bb-header-info-sheet {") ? "YES (BAD)" : "no"}`);
console.log(`.bb-header-info-content { base remaining: ${t.includes(".bb-header-info-content {") ? "YES (BAD)" : "no"}`);
console.log(`.bb-header-info-sheet (marker, group+context) refs: ${(t.match(/\.bb-header-info-sheet/g) || []).length} (expect 3: 838 group + 2 context)`);
console.log(`.bb-header-info-content (marker, context) refs: ${(t.match(/\.bb-header-info-content/g) || []).length} (expect 1: context)`);
