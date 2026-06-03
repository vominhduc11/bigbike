// Strip bb-wp-tabs CSS, KEEPING only `.bb-wp-tabs .tab-panel *{line-height:inherit}`.
// Removes shell/self/responsive/pdp-mobile rules and splits .bb-wp-tabs out of the
// 3 large-desktop max-width groups. Content-anchored with assertions + backup.
const fs = require("fs");
const path = "app/globals.css";
const src = fs.readFileSync(path, "utf8");
fs.writeFileSync(path + ".bak", src);
let lines = src.split("\n");

const find = (pred, from = 0) => { for (let i = from; i < lines.length; i++) if (pred(lines[i])) return i; return -1; };
const eq = (s) => (l) => l === s;
const has = (s) => (l) => l.includes(s);

const removals = [];
const KEEP = ".bb-wp-tabs .tab-panel * {"; // the one rule we preserve

// --- Base region ---
{
  const selfIdx = find(eq(".bb-wp-tabs {"));
  const keepIdx = find(eq(KEEP), selfIdx);
  const videoIdx = find(eq(".bb-wp-video-single iframe,"), keepIdx);
  if (selfIdx < 0 || keepIdx < 0 || videoIdx < 0) throw new Error("base anchors");
  // chunk A: self .. line before keep rule (incl trailing blank)
  removals.push({ start: selfIdx, end: keepIdx - 1 });
  // chunk B: from line after keep-rule's blank .. line before video-single (keep one blank)
  // keep rule = keepIdx..keepIdx+2 ('}'), keepIdx+3 = blank
  removals.push({ start: keepIdx + 4, end: videoIdx - 1 });
}

// --- <=1023 tablet: 3 tabs rules, keep .bb-wp-video-grid ---
{
  const start = find(eq("  .bb-wp-tabs {"));
  const vg = find(eq("  .bb-wp-video-grid {"), start);
  if (start < 0 || vg < 0) throw new Error("<=1023 anchors");
  removals.push({ start, end: vg - 1 });
}

// --- pdp-scoped mobile block (comment + all .bb-wp-pdp .bb-wp-tabs rules) ---
{
  const comment = find(has("Divider + gap marking the buy/overview"));
  const start = find(eq("  .bb-wp-pdp .bb-wp-tabs {"), comment);
  const firstChild = find(eq("  .bb-wp-pdp .bb-wp-tabs .tab-panel:first-child {"), start);
  const close = find(eq("  }"), firstChild);
  if (comment < 0 || start < 0 || firstChild < 0 || close < 0) throw new Error("pdp-mobile anchors");
  // remove from comment .. close; keep the blank line before the comment as separator
  removals.push({ start: comment, end: close });
}

// --- <=767 generic: .bb-wp-tabs self/.tabs-nav/.nav-tabs/.nav-item ---
{
  // the <=767 .bb-wp-tabs is the LAST occurrence of '  .bb-wp-tabs {' (tablet one already queued for removal, but indices computed on original array)
  let start = -1;
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i] === "  .bb-wp-tabs {") { start = i; break; }
  const navItem = find(eq("  .bb-wp-tabs .nav-item {"), start);
  const close = find(eq("  }"), navItem);
  if (start < 0 || navItem < 0 || close < 0) throw new Error("<=767 anchors");
  removals.push({ start, end: close });
}

// Apply block removals back-to-front
removals.sort((a, b) => b.start - a.start);
for (const { start, end } of removals) {
  if (start > end) throw new Error(`bad range ${start}>${end}`);
  console.log(`remove ${start + 1}..${end + 1}: "${lines[start].trim()}" .. "${lines[end].trim()}"`);
  lines.splice(start, end - start + 1);
}

// --- Split .bb-wp-tabs out of the 3 large-desktop groups: remove standalone '  .bb-wp-tabs,' lines ---
let groupRemoved = 0;
lines = lines.filter((l) => { if (l === "  .bb-wp-tabs,") { groupRemoved++; return false; } return true; });
console.log(`removed ${groupRemoved} group-member lines '  .bb-wp-tabs,'`);

fs.writeFileSync(path, lines.join("\n"));
console.log("done. backup at " + path + ".bak");
