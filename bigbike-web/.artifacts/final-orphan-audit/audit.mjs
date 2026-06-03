import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CSS = path.join(ROOT, "app/globals.css");
const css = fs.readFileSync(CSS, "utf8");

// 1) extract all class-selector tokens `.bb-xxx` from globals.css (NOT --bb-* vars, NOT comments-only)
//    strip block comments first so commented-out class names don't count as "defined"
const cssNoComments = css.replace(/\/\*[\s\S]*?\*\//g, "");
const tokenSet = new Set();
for (const m of cssNoComments.matchAll(/\.(bb-[a-z0-9-]+)/g)) tokenSet.add(m[1]);
// also catch [class*=bb-xxx] partial-match selectors
for (const m of cssNoComments.matchAll(/\[class\*=["']?(bb-[a-z0-9-]+)/g)) tokenSet.add(m[1]);
const tokens = [...tokenSet].sort();

// 2) build haystack from source (exclude .css and .md and .artifacts)
const SRC_DIRS = ["app", "components", "lib", "hooks", "context", "e2e", "styles"];
const exts = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs", ".cjs"]);
let haystack = "";
function walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name === ".next" || e.name === ".artifacts") continue;
      walk(p);
    } else if (exts.has(path.extname(e.name))) {
      haystack += "\n" + fs.readFileSync(p, "utf8");
    }
  }
}
for (const d of SRC_DIRS) walk(path.join(ROOT, d));

// 3) class-boundary match: token NOT followed by [a-z0-9-] (so bb-home != bb-home-news)
function used(tok) {
  const re = new RegExp(tok.replace(/[-]/g, "\\-") + "(?![a-z0-9-])");
  return re.test(haystack);
}
// dynamic construction heuristics
const dynamic = /["'`]bb-["'`]?\s*\+|`bb-\$\{|className=\{`[^`]*bb-\$/.test(haystack);

const dead = tokens.filter((t) => !used(t));
const live = tokens.filter((t) => used(t));

console.log("total bb-* class tokens in globals.css selectors:", tokens.length);
console.log("LIVE (referenced in source):", live.length);
console.log("DEAD (0 source refs):", dead.length);
console.log("dynamic bb- construction detected anywhere:", dynamic);
console.log("\n=== DEAD TOKENS (candidates) ===");
for (const t of dead) console.log("  " + t);
fs.writeFileSync(".artifacts/final-orphan-audit/dead.json", JSON.stringify({ dead, live }, null, 2));
