// Dead bb-* class audit: extract every .bb-* class token used in globals.css
// selectors, then report tokens with ZERO references anywhere in the source tree
// (className strings, cn() args, JS querySelector/classList, etc). 0-ref = dead
// orphan candidate (review manually — some may be added via dynamic strings).
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync("app/globals.css", "utf8");
// collect class tokens from selectors (strip pseudo/combinators)
const tokens = new Set();
for (const m of css.matchAll(/\.(bb-[a-z0-9-]+)/g)) tokens.add(m[1]);

// build source haystack (all tsx/ts/jsx/js under app, components, lib, e2e)
const exts = new Set([".tsx", ".ts", ".jsx", ".js", ".mjs"]);
const roots = ["app", "components", "lib", "e2e", "hooks", "context", "providers"];
let hay = "";
const walk = (d) => {
  let ents;
  try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== ".next") walk(p); }
    else if (exts.has(path.extname(e.name))) hay += fs.readFileSync(p, "utf8");
  }
};
roots.forEach(walk);

const dead = [];
for (const t of tokens) {
  // reference = the bare token appears anywhere in source (className, cn, querySelector, etc.)
  if (!hay.includes(t)) dead.push(t);
}
dead.sort();
console.log(`tokens in globals: ${tokens.size}`);
console.log(`ZERO-reference (dead candidates): ${dead.length}`);
dead.forEach((t) => console.log("  " + t));
