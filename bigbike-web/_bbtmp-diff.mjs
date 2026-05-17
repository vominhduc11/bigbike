// Pixel-diff two screenshot dirs with sharp.
// Usage: node _bbtmp-diff.mjs <baselineDir> <currentDir> [diffDir]
import fs from "fs";
import path from "path";
import sharp from "sharp";

const A = process.argv[2], B = process.argv[3];
const DIFF = process.argv[4] ?? null;
if (!A || !B) { console.error("usage: node _bbtmp-diff.mjs <baseDir> <curDir> [diffDir]"); process.exit(1); }
if (DIFF) fs.mkdirSync(DIFF, { recursive: true });

const files = fs.readdirSync(A).filter((f) => f.endsWith(".png"));
let worst = 0;
const rows = [];
for (const f of files) {
  const pa = path.join(A, f), pb = path.join(B, f);
  if (!fs.existsSync(pb)) { rows.push([f, "MISSING in current"]); continue; }
  // normalise to the smaller common size, raw RGB
  const ma = await sharp(pa).metadata();
  const mb = await sharp(pb).metadata();
  const w = Math.min(ma.width, mb.width);
  const h = Math.min(ma.height, mb.height);
  const ra = await sharp(pa).extract({ left: 0, top: 0, width: w, height: h }).removeAlpha().raw().toBuffer();
  const rb = await sharp(pb).extract({ left: 0, top: 0, width: w, height: h }).removeAlpha().raw().toBuffer();
  let diffPx = 0;
  const out = DIFF ? Buffer.alloc(w * h * 3) : null;
  for (let i = 0; i < ra.length; i += 3) {
    const d = Math.abs(ra[i] - rb[i]) + Math.abs(ra[i + 1] - rb[i + 1]) + Math.abs(ra[i + 2] - rb[i + 2]);
    if (d > 24) {
      diffPx++;
      if (out) { out[i] = 255; out[i + 1] = 0; out[i + 2] = 0; }
    } else if (out) { out[i] = ra[i]; out[i + 1] = ra[i + 1]; out[i + 2] = ra[i + 2]; }
  }
  const total = w * h;
  const pct = (diffPx / total) * 100;
  worst = Math.max(worst, pct);
  const sizeNote = (ma.width !== mb.width || ma.height !== mb.height)
    ? ` [size ${ma.width}x${ma.height} vs ${mb.width}x${mb.height}]` : "";
  rows.push([f, `${pct.toFixed(3)}% (${diffPx}px)${sizeNote}`]);
  if (out && pct > 0.05) {
    await sharp(out, { raw: { width: w, height: h, channels: 3 } })
      .png().toFile(path.join(DIFF, f.replace(".png", "--diff.png")));
  }
}
console.log("=== pixel diff: " + A + " vs " + B + " ===");
for (const [f, r] of rows.sort()) console.log("  " + f.padEnd(26) + " " + r);
console.log(`worst: ${worst.toFixed(3)}%`);
