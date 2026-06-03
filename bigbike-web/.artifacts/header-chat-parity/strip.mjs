// Strip floating-chat leaf CSS (CRLF-aware). KEEP: @keyframes socialRotate +
// b24-widget-button-visible (referenced inline), the round-shape :is() group (split
// out the 3 b24 members), the .bb-floating-chat-anchor parent-state hides + pdp-sticky.
import fs from "node:fs";
const f = "app/globals.css";
let t = fs.readFileSync(f, "utf8");
const before = t.length;
const EOL = t.includes("\r\n") ? "\r\n" : "\n";
const N = (s) => s.split("\n").join(EOL);

// 1) range: the whole .bb-chat-float … open-state block, up to @keyframes socialRotate
function cutRange(startMark, endMark) {
  const i = t.indexOf(startMark);
  const j = t.indexOf(endMark);
  if (i < 0 || j < 0 || j < i) throw new Error("range markers not found: " + startMark.slice(0, 30));
  t = t.slice(0, i) + t.slice(j);
}
cutRange("/* Floating contact widget", "@keyframes socialRotate");
cutRange("/* Load-in scale animation */", "@keyframes b24-widget-button-visible");

// 2) exact rules / blocks (each + its trailing blank line)
const exact = [
  `.bb-chat-item-icon svg circle {\n  border-radius: 50%;\n}`,
  `@media (max-width: 767px) {\n  /* Icon-only FAB across the whole mobile range — the "Bạn cần hỗ trợ?" title\n     bubble overlapped PDP content (description text / right-most swatch). */\n  #sudovn-btn-title,\n  .bb-chat-title {\n    display: none;\n  }\n}`,
  `@media (max-width: 430px) {\n  #sudovn-btn-social {\n    min-width: 260px;\n  }\n}`,
  `  .bb-floating-chat-anchor {\n    right: max(14px, env(safe-area-inset-right)) !important;\n    bottom: calc(var(--bb-mobile-nav-height) + env(safe-area-inset-bottom) + 12px) !important;\n  }\n\n  .bb-floating-chat-anchor .b24-widget-button-block,\n  .bb-floating-chat-anchor .b24-widget-button-inner-block {\n    width: 52px;\n    height: 52px;\n  }\n\n  .bb-floating-chat-anchor .b24-widget-button-inner-mask {\n    width: 64px;\n    height: 64px;\n  }`,
  `  .bb-floating-chat-anchor {\n    right: max(16px, env(safe-area-inset-right)) !important;\n    bottom: calc(var(--bb-mobile-nav-height) + env(safe-area-inset-bottom) + 16px) !important;\n    z-index: 660 !important;\n  }\n\n  .bb-floating-chat-anchor .b24-widget-button-block,\n  .bb-floating-chat-anchor .b24-widget-button-inner-block {\n    width: 48px !important;\n    height: 48px !important;\n  }\n\n  .bb-floating-chat-anchor .b24-widget-button-inner-mask {\n    width: 60px !important;\n    height: 60px !important;\n  }`,
  `/* FAB nổi trên mọi UI thường — portal panel tự quản lý z-index riêng qua createPortal */\n.bb-floating-chat-anchor {\n  z-index: 660;\n}`,
];
for (const r of exact) {
  const target = N(r) + EOL + EOL;
  const i = t.indexOf(target);
  if (i < 0) throw new Error("exact not found: " + r.slice(0, 44));
  if (t.indexOf(target, i + 1) >= 0) throw new Error("AMBIGUOUS: " + r.slice(0, 44));
  t = t.slice(0, i) + t.slice(i + target.length);
}

// 3) round-shape group: drop the 3 b24 members
const roundOld = N(`.bb-theme :is(.bb-round, .bb-account-avatar, .swiper-pagination-bullet, .b24-widget-button-block, .b24-widget-button-inner-block, .b24-widget-button-inner-mask) {`);
const roundNew = N(`.bb-theme :is(.bb-round, .bb-account-avatar, .swiper-pagination-bullet) {`);
if (!t.includes(roundOld)) throw new Error("round group not found");
t = t.replace(roundOld, roundNew);

// 4) cleanup: collapse any 3+ newline runs to a single blank line
t = t.replace(/(\r?\n){3,}/g, EOL + EOL);

fs.writeFileSync(f, t);
console.log(`globals.css: ${before} -> ${t.length} bytes (-${before - t.length})`);
const ob = (t.match(/{/g) || []).length, cb = (t.match(/}/g) || []).length;
console.log(`braces: ${ob} open / ${cb} close ${ob === cb ? "OK" : "MISMATCH"}`);
for (const cls of [".bb-chat-", "b24-widget-button-block", "b24-widget-button-inner", "sudovn-btn-social", "bbWidgetShow", "#sudovn-btn"]) {
  console.log(`  "${cls}" remaining: ${(t.match(new RegExp(cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length}`);
}
console.log(`  @keyframes socialRotate kept: ${t.includes("@keyframes socialRotate")}`);
console.log(`  @keyframes b24-widget-button-visible kept: ${t.includes("@keyframes b24-widget-button-visible")}`);
console.log(`  .bb-floating-chat-anchor refs (parent-state+pdp, expect ~9): ${(t.match(/\.bb-floating-chat-anchor/g) || []).length}`);
