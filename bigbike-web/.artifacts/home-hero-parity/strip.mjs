// CRLF-aware line-splice for globals.css — removes bb-main-banner leaf CSS
// (container/img/link/arrows/pagination/copy), keeping swiper mechanism + markers.
// Each op asserts anchor text on its boundary lines; applied bottom→top so
// earlier line numbers stay valid. Verifies brace balance + residual refs after.
import fs from "node:fs";

const FILE = "app/globals.css";
const raw = fs.readFileSync(FILE, "utf8");
const EOL = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(EOL); // lines[i] = (i+1)-th line, no EOL

// op: { s, e, asserts: [[lineNo, substr]...], replace: [..lines] }
const ops = [
  // A: comment + container + @1920 + @2560 tiers -> trimmed comment
  {
    s: 1642, e: 1664,
    asserts: [[1642, "Homepage hero (WP #main-banner parity)"], [1648, ".bb-main-banner {"], [1661, "2560px"], [1664, "}"]],
    replace: [
      "/* -- Homepage hero (WP #main-banner parity) — container/img/arrows/pagination",
      "   leaf styling inlined in HeroSlider.tsx (height max(40vw,300px) ≈ 2.5:1 banner AR,",
      "   capped at 3XL 1080 / 4XL 1200). Swiper-generated DOM keeps its mechanism rules below. */",
    ],
  },
  // B: drop the two .bb-main-banner-link members from the display:block group
  {
    s: 1668, e: 1670,
    asserts: [[1668, ".bb-main-banner .swiper-slide,"], [1669, ".bb-main-banner-link,"], [1670, ".bb-main-banner-link picture {"]],
    replace: [".bb-main-banner .swiper-slide {"],
  },
  // C: remove link + img + arrows + pagination + all arrow tiers (1686-1831)
  {
    s: 1686, e: 1831,
    asserts: [[1686, ".bb-main-banner-link {"], [1692, ".bb-main-banner-img {"], [1701, ".bb-main-banner-arrow {"], [1745, ".bb-main-banner-pagination {"], [1830, "right: 64px"], [1831, "}"]],
    replace: [],
  },
  // D: redundant .bb-home #main-banner { position; overflow }
  {
    s: 4993, e: 4997,
    asserts: [[4993, ".bb-home #main-banner {"], [4995, "overflow: hidden;"], [4996, "}"], [4997, ""]],
    replace: [],
  },
  // E: .swiper-slide a/.bb-main-banner-link display:block + span sizing (dead)
  {
    s: 5005, e: 5016,
    asserts: [[5005, ".bb-home #main-banner .swiper-slide a,"], [5010, ".swiper-slide a span,"], [5015, "}"], [5016, ""]],
    replace: [],
  },
  // F: split base display:none group — drop .bb-main-banner-copy member
  {
    s: 5431, e: 5432,
    asserts: [[5431, ".bb-mobile-drawer-head,"], [5432, ".bb-main-banner-copy {"]],
    replace: [".bb-mobile-drawer-head {"],
  },
  // G: ≤767 mobile-shell-dark banner block (bg/link/::after/copy/kicker/title/span)
  {
    s: 5780, e: 5858,
    asserts: [[5780, ".bb-home #main-banner,"], [5786, ".bb-main-banner-link {"], [5799, ".bb-main-banner-copy {"], [5843, ".bb-main-banner-copy span {"], [5857, "}"], [5858, ""]],
    replace: [],
  },
  // H: ≤767 light-reskin copy padding + title (dead — copy hidden)
  {
    s: 6847, e: 6856,
    asserts: [[6847, ".bb-main-banner-copy {"], [6851, ".bb-main-banner-copy .bb-main-banner-title {"], [6855, "}"], [6856, ""]],
    replace: [],
  },
  // I: ≤767 polish-pass hide ::after + copy (copy now inline hidden; ::after gone)
  {
    s: 6919, e: 6923,
    asserts: [[6919, ".bb-main-banner-link::after,"], [6920, ".bb-main-banner-copy {"], [6922, "}"], [6923, ""]],
    replace: [],
  },
];

// validate asserts against ORIGINAL line numbers first
for (const op of ops) {
  for (const [ln, sub] of op.asserts) {
    const actual = lines[ln - 1];
    if (actual === undefined || (sub === "" ? actual.trim() !== "" : !actual.includes(sub))) {
      throw new Error(`ASSERT FAIL op ${op.s}-${op.e}: line ${ln} expected "${sub}" got "${actual}"`);
    }
  }
}

// apply bottom→top
const sorted = [...ops].sort((a, b) => b.s - a.s);
let out = lines.slice();
for (const op of sorted) {
  out.splice(op.s - 1, op.e - op.s + 1, ...op.replace);
}
const result = out.join(EOL);

// brace balance check
const ob = (result.match(/\{/g) || []).length;
const cb = (result.match(/\}/g) || []).length;
if (ob !== cb) throw new Error(`BRACE IMBALANCE: { ${ob} vs } ${cb}`);

// residual leaf-selector check (these should be GONE as styled rules)
const dead = ["bb-main-banner-arrow", "bb-main-banner-pagination", "bb-main-banner-kicker", "bb-main-banner-title", "bb-main-banner-picture"];
const residual = dead.filter((c) => result.includes(c));
fs.writeFileSync(".artifacts/home-hero-parity/globals.css.bak", raw);
fs.writeFileSync(FILE, result);
console.log(`OK. lines ${lines.length} -> ${out.length} (removed ${lines.length - out.length}). braces ${ob}/${cb}.`);
console.log("residual dead-selector refs:", residual.length ? residual : "none");
// surviving markers we EXPECT to remain (e2e/swiper/scope)
const keep = ["bb-main-banner-img", "bb-main-banner-link", "bb-main-banner-copy", ".bb-main-banner .swiper"];
console.log("kept markers present:", keep.filter((c) => result.includes(c)));
