// CRLF-aware strip of dead .bb-home WP-utility rules. All 5 confirmed dead
// (0 standalone class usages in the home tree / anywhere). Keep .bb-home
// .text-center (live: about section). Replace the whole block with text-center.
const fs = require("fs");
const path = "app/globals.css";
let css = fs.readFileSync(path, "utf8");
const before = css;
const L = (...l) => l.join("\r\n");

const find = L(
  ".bb-home .align-items-center {",
  "  align-items: center;",
  "}",
  "",
  ".bb-home .text-center {",
  "  text-align: center;",
  "}",
  "",
  ".bb-home .white h3 {",
  "  color: #fff;",
  "}",
  ".bb-home .pb-40 { padding-bottom: 40px; }",
  ".bb-home .mb-10 { margin-bottom: 10px; }",
  "",
  ".bb-home .btn {",
  "  display: inline-block;",
  "  width: 170px;",
  "  padding: 0;",
  "  border-radius: 0;",
  "  color: #000;",
  '  font-family: "Barlow Condensed", sans-serif;',
  "  font-weight: 600;",
  "  line-height: 52px;",
  "  text-decoration: none;",
  "  opacity: 1;",
  "}",
);
const repl = L(".bb-home .text-center {", "  text-align: center;", "}");

const n = css.split(find).length - 1;
if (n !== 1) throw new Error(`expected 1 match, found ${n}`);
css = css.replace(find, repl);

const bal = (s) => (s.match(/{/g) || []).length - (s.match(/}/g) || []).length;
if (bal(before) !== bal(css)) throw new Error(`brace balance changed: ${bal(before)} -> ${bal(css)}`);

const dead = css.match(/\.bb-home \.(align-items-center|white h3|pb-40|mb-10|btn)\b/g);
if (dead) throw new Error("residual dead refs: " + [...new Set(dead)].join(", "));
if ((css.match(/\.bb-home \.text-center \{/g) || []).length !== 1) throw new Error("text-center lost!");

fs.writeFileSync(path, css);
console.log(`OK. ${before.length - css.length} bytes removed. brace balance ${bal(css)}.`);
