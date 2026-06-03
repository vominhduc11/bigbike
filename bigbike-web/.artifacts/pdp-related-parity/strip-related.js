// Strip bb-wp-related DECORATION CSS, KEEPING the carousel mechanism
// (.bb-wp-related-track + .bb-wp-related-track .swiper-slide + responsive gap/scroll).
// Content-anchored with assertions + backup + brace-balance left to caller.
const fs = require("fs");
const path = "app/globals.css";
let src = fs.readFileSync(path, "utf8");
fs.writeFileSync(path + ".bak", src);
let lines = src.split("\n");

const findEq = (s, from = 0) => { for (let i = from; i < lines.length; i++) if (lines[i] === s) return i; return -1; };
const findClose = (indent, from) => { for (let i = from; i < lines.length; i++) if (lines[i] === indent + "}") return i; return -1; };

const removals = [];

// 1) base chunk before the track (section/.related.products/.container/.block-title/.sub-title
//    /@media sub-title/.related_heading/.product-related-woo/.swiper-container)
{
  const s = findEq(".bb-wp-related {");
  const track = findEq(".bb-wp-related-track {", s);
  if (s < 0 || track < 0) throw new Error("base chunk1");
  removals.push({ start: s, end: track - 1 });
}
// 2) base swiper-button + prev + next (after the kept slide rule)
{
  const s = findEq(".bb-wp-related .swiper-button {");
  const next = findEq(".bb-wp-related .swiper-button-next {", s);
  const e = findClose("", next);
  if (s < 0 || next < 0 || e < 0) throw new Error("base chunk2");
  removals.push({ start: s, end: e });
}
// 3) <=1024 swiper-button prev/next (keep .bb-wp-pdp-layout in same block)
{
  const s = findEq("  .bb-wp-related .swiper-button-prev {");
  const next = findEq("  .bb-wp-related .swiper-button-next {", s);
  const e = findClose("  ", next);
  if (s < 0 || next < 0 || e < 0) throw new Error("<=1024 buttons");
  const start = lines[s - 1] === "" ? s - 1 : s;
  removals.push({ start, end: e });
}
// 4) <=1023 swiper-button display:none
{
  const s = findEq("  .bb-wp-related .swiper-button {");
  const e = findClose("  ", s);
  if (s < 0 || e < 0) throw new Error("<=1023 button");
  const start = lines[s - 1] === "" ? s - 1 : s;
  removals.push({ start, end: e });
}
// 5) <=767 .bb-wp-related.related.products + .bb-wp-related
{
  const s = findEq("  .bb-wp-related.related.products {");
  const sec = findEq("  .bb-wp-related {", s);
  const e = findClose("  ", sec);
  if (s < 0 || sec < 0 || e < 0) throw new Error("<=767 section");
  removals.push({ start: s, end: e });
}

removals.sort((a, b) => b.start - a.start);
for (const { start, end } of removals) {
  if (start > end) throw new Error(`bad range ${start}>${end}`);
  console.log(`remove ${start + 1}..${end + 1}: "${lines[start].trim()}" .. "${lines[end].trim()}"`);
  lines.splice(start, end - start + 1);
}
src = lines.join("\n");

// 6) split .bb-wp-related out of the 3 large-desktop max-width groups
//    (it's the last member: `  .bb-wp-pdp-layout,\n  .bb-wp-related {`)
const before = src;
src = src.replace(/  \.bb-wp-pdp-layout,\n  \.bb-wp-related \{/g, "  .bb-wp-pdp-layout {");
const groupCount = (before.match(/  \.bb-wp-pdp-layout,\n  \.bb-wp-related \{/g) || []).length;
console.log(`split ${groupCount} large-desktop groups`);

fs.writeFileSync(path, src);
console.log("done. backup at " + path + ".bak");
