// Strip buy-box CSS from globals.css. Removes 6 line ranges (1-based, inclusive).
// KEEPS: .bb-wp-pdp/.product-information *{line-height:1} reset, .desc richtext
// block, all shell (.bb-wp-pdp-layout/-gallery-col/-info-col/.bb-breadcrumb),
// video + related-track responsive, tabs marker.
const fs = require("fs");
const path = "app/globals.css";
const apply = process.argv.includes("--apply");
const src = fs.readFileSync(path, "utf8");
const lines = src.split("\n");

// Ranges to REMOVE, expressed with an expected first/last line substring so we
// fail loudly if numbering drifted. Process high->low so indices stay valid.
const ranges = [
  { a: 9145, b: 9240, first: ".product-information .title {", last: "" },
  { a: 6059, b: 6088, first: ".product-information .title h1 {", last: "" },
  { a: 5692, b: 5939, first: ".product-information .size {", last: "" },
  { a: 5524, b: 5659, first: ".product-information .title {", last: "" },
  { a: 2594, b: 2595, first: "Shared utility: inline state text", last: ".bb-error-text {" },
  { a: 2353, b: 2356, first: "Black, skewed", last: ".bb-pdp-stock-badge-label {" },
];

function brace(s) {
  let n = 0;
  for (const c of s) { if (c === "{") n++; else if (c === "}") n--; }
  return n;
}

console.log("PRE brace balance:", brace(src));
let ok = true;
for (const r of ranges) {
  const fl = lines[r.a - 1];
  const ll = lines[r.b - 1];
  const keepBefore = lines[r.a - 2];
  const keepAfter = lines[r.b]; // line after range
  const block = lines.slice(r.a - 1, r.b).join("\n");
  const bb = brace(block);
  const firstOk = r.first === "" || (fl && fl.includes(r.first));
  const lastOk = r.last === "" || (ll && ll.includes(r.last));
  console.log(`\n--- range ${r.a}..${r.b}  (braceΔ=${bb}) firstOk=${firstOk} lastOk=${lastOk}`);
  console.log(`  keepBefore[${r.a - 1}]: ${JSON.stringify(keepBefore)}`);
  console.log(`  first    [${r.a}]: ${JSON.stringify(fl)}`);
  console.log(`  last     [${r.b}]: ${JSON.stringify(ll)}`);
  console.log(`  keepAfter[${r.b + 1}]: ${JSON.stringify(keepAfter)}`);
  if (bb !== 0 || !firstOk || !lastOk) ok = false;
}

if (!ok) { console.log("\nABORT: a range failed validation."); process.exit(1); }

if (apply) {
  let out = lines.slice();
  for (const r of ranges) out.splice(r.a - 1, r.b - r.a + 1);
  const res = out.join("\n");
  console.log("\nPOST brace balance:", brace(res), " lines:", out.length);
  fs.writeFileSync(path, res);
  console.log("WROTE", path);
} else {
  console.log("\nDRY RUN ok. Re-run with --apply to write.");
}
