// Strip the now-dead .bb-archive-pagination* block (PaginationNav archive
// variant migrated to inline Tailwind). Self-contained block, CRLF-aware.
const fs = require("fs");
const PATH = "c:/Users/ADMIN/OneDrive/Documents/bigbike/bigbike-web/app/globals.css";
let css = fs.readFileSync(PATH, "utf8");
const before = css.length;
const nl = (s) => s.replace(/\n/g, "\r\n");

const start = nl(".bb-archive-pagination.pagination {");
const end = nl(".bb-archive-page-icon {\n  font-size: 22px;\n  line-height: 1;\n}");
const i = css.indexOf(start);
if (i === -1 || css.indexOf(start, i + 1) !== -1) throw new Error("start anchor missing/duplicate");
const j = css.indexOf(end, i);
if (j === -1) throw new Error("end anchor missing");
const cut = css.slice(i, j + end.length);
const open = (cut.match(/{/g) || []).length, close = (cut.match(/}/g) || []).length;
if (open !== close) throw new Error(`span unbalanced ${open}/${close}`);
let k = i;
if (css.slice(0, k).endsWith("\r\n\r\n")) k -= 2; // swallow one leading blank line
css = css.slice(0, k) + css.slice(j + end.length);

if (/bb-archive-pagination|bb-archive-page-icon/.test(css)) throw new Error("leftover refs!");
const o = (css.match(/{/g) || []).length, c = (css.match(/}/g) || []).length;
if (o !== c) throw new Error(`file unbalanced ${o}/${c}`);
fs.writeFileSync(PATH, css, "utf8");
console.log(`DONE ${before} -> ${css.length} (-${before - css.length}). braces ${o}/${c}. 0 leftovers.`);
