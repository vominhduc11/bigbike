// Commit 1 — strip user-menu CSS from globals.css (CRLF-aware, content-anchored).
import fs from "node:fs";
const f = "app/globals.css";
let t = fs.readFileSync(f, "utf8");
const before = t.length;
const EOL = t.includes("\r\n") ? "\r\n" : "\n";

// 1) Remove the whole .bb-header-user / .bb-header-user-menu block (base + ::after
//    bridge + ::before caret + .is-open + reduced-motion) up to .bb-header-info-sheet.
const start = t.indexOf(".bb-header-user {");
const end = t.indexOf(".bb-header-info-sheet {");
if (start < 0 || end < 0 || end < start) throw new Error("block markers not found");
// keep exactly one blank line between the preceding rule and .bb-header-info-sheet
t = t.slice(0, start) + t.slice(end);

// 2) Drop the now-dead .bb-header-user member from the ≤767 hide rule, keeping
//    .bb-header-info-trigger (the inline max-[1260px]:!hidden already covers it).
const rule = `  .bb-header-user,${EOL}  .bb-header-info-trigger {`;
if (!t.includes(rule)) throw new Error("≤767 hide rule not found");
t = t.replace(rule, "  .bb-header-info-trigger {");

fs.writeFileSync(f, t);
console.log(`globals.css: ${before} -> ${t.length} bytes (-${before - t.length})`);

// brace balance sanity
const ob = (t.match(/{/g) || []).length, cb = (t.match(/}/g) || []).length;
console.log(`braces: ${ob} open / ${cb} close ${ob === cb ? "OK" : "MISMATCH"}`);

// residual-ref check: bb-header-user / bb-header-user-menu must be gone
for (const cls of [".bb-header-user ", ".bb-header-user{", ".bb-header-user,", ".bb-header-user-menu"]) {
  if (t.includes(cls)) console.log(`  RESIDUAL: "${cls}" still present`);
}
console.log("residual check done");
