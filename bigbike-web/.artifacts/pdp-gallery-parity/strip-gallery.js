// Strip bb-wp-gallery-* CSS spans from globals.css, keeping @keyframes bb-gallery-fade-in.
// Content-anchored: each range is [startMarker .. before endMarker]; asserts markers exist & are unique-enough.
const fs = require("fs");
const path = "app/globals.css";
const src = fs.readFileSync(path, "utf8");
fs.writeFileSync(path + ".bak", src);
const lines = src.split("\n");

function idxOf(pred, from = 0) {
  for (let i = from; i < lines.length; i++) if (pred(lines[i])) return i;
  return -1;
}
const removals = []; // {start, end} inclusive line indices (0-based)

// 1) Base gallery block: `.bb-wp-gallery {` (col 0) .. before `@keyframes bb-gallery-fade-in {`
{
  const start = idxOf((l) => l === ".bb-wp-gallery {");
  const kf = idxOf((l) => l === "@keyframes bb-gallery-fade-in {");
  if (start < 0 || kf < 0 || kf <= start) throw new Error("base block markers not found");
  removals.push({ start, end: kf - 1 }); // includes trailing blank before keyframe
}

// 2) <=1023 block: indented `.bb-wp-gallery {` after `.bb-wp-pdp-info-col {` (~6366) .. before title h1
{
  const infoCol = idxOf((l) => l.trim() === ".bb-wp-pdp-info-col {", 6360);
  const start = idxOf((l) => l === "  .bb-wp-gallery {", infoCol);
  const titleH1 = idxOf((l) => l === "  .bb-wp-pdp .product-information .title h1 {", start);
  if (infoCol < 0 || start < 0 || titleH1 < 0) throw new Error("<=1023 markers not found");
  removals.push({ start, end: titleH1 - 1 });
}

// 3) <=419 dead gallery rules: `.bb-wp-gallery-thumbs {` .. closing `}` of `.bb-wp-gallery-thumb {`
{
  const thumbs = idxOf((l) => l === "  .bb-wp-gallery-thumbs {", 6470);
  const thumb = idxOf((l) => l === "  .bb-wp-gallery-thumb {", thumbs);
  // end = the `  }` closing the thumb rule (first `  }` after thumb)
  const end = idxOf((l) => l === "  }", thumb);
  if (thumbs < 0 || thumb < 0 || end < 0) throw new Error("<=419 markers not found");
  // also remove the blank line before thumbs (separator after related-track rule)
  const startBlank = lines[thumbs - 1] === "" ? thumbs - 1 : thumbs;
  removals.push({ start: startBlank, end });
}

// 4) <=767 block: indented `.bb-wp-gallery {` after info-col (~9571) .. before `.bb-wp-pdp .product-information .title {`
{
  const infoCol = idxOf((l) => l.trim() === ".bb-wp-pdp-info-col {", 9560);
  const start = idxOf((l) => l === "  .bb-wp-gallery {", infoCol);
  const title = idxOf((l) => l === "  .bb-wp-pdp .product-information .title {", start);
  if (infoCol < 0 || start < 0 || title < 0) throw new Error("<=767 markers not found");
  removals.push({ start, end: title - 1 });
}

// Apply removals back-to-front
removals.sort((a, b) => b.start - a.start);
for (const { start, end } of removals) {
  console.log(`removing lines ${start + 1}..${end + 1}: "${lines[start].trim()}" .. "${lines[end].trim()}"`);
  lines.splice(start, end - start + 1);
}
fs.writeFileSync(path, lines.join("\n"));
console.log("done. backup at " + path + ".bak");
