// FLOATING CHAT (b24-widget FAB + bb-chat panel) A/B probe — class-injection.
// Replicates the EXACT component structure (b24-widget-button-bottom on the inner-
// block button, NOT the wrapper) so the dead open-state rules (gray/scale) stay dead
// identically OLD↔NEW. Inject into a .bb-theme ancestor (the round-shape :is() group
// + button reset need it). Closed FAB at desktop + mobile (in a .bb-floating-chat-
// anchor host for the mobile-size descendant rules); open FAB + panel items.
// Usage: BASE=http://localhost:3000 VARIANT=old node probe.mjs capture old.json
//        BASE=http://localhost:3007 VARIANT=new node probe.mjs capture new.json
//        node probe.mjs diff old.json new.json
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.BASE || "http://localhost:3007";
const VARIANT = process.env.VARIANT || "new";

// --- class sets ---------------------------------------------------------------
const OLD = {
  float: "bb-chat-float",
  title: "bb-chat-title",
  container: "b24-widget-button-inner-container",
  mask: "b24-widget-button-inner-mask",
  block: "b24-widget-button-block",
  innerBlock: "b24-widget-button-inner-block",
  innerBlockOpen: "b24-widget-button-inner-block b24-widget-button-bottom",
  iconWrap: "b24-widget-button-icon-container",
  iconItem: "b24-widget-button-inner-item b24-widget-button-icon-animation",
  closeItem: "b24-widget-button-inner-item b24-widget-button-close",
  panelItem: "sudovn-btn-social-item bb-chat-item",
  panelIcon: "sudovn-btn-social-item-icon bb-chat-item-icon",
  panelLabel: "sudovn-btn-social-item-label bb-chat-item-label",
};
const NEW = {
  float: "relative [direction:ltr] font-[Arial,sans-serif] flex flex-col-reverse items-end",
  title: "bg-[var(--bb-chat-title-bg)] px-[5px] py-0.5 text-[var(--bb-chat-title-text)] text-[13px] font-[Arial,sans-serif] whitespace-nowrap relative bottom-[42px] right-[70px] max-md:hidden",
  container: "relative inline-block",
  mask: "absolute -top-2 -left-2 w-[calc(100%+16px)] h-[82px] min-w-[66px] !rounded-[50%] bg-[var(--bb-chat-title-bg)] opacity-20 pointer-events-none",
  block: "w-[66px] h-[66px] !rounded-[50%] box-border overflow-hidden",
  innerBlock: "relative w-[66px] h-[66px] !rounded-[50%] bg-[var(--bb-chat-title-bg)] text-[var(--bb-chat-title-text)] border-none cursor-pointer flex items-center justify-center [outline:none] box-border focus-visible:[outline:2px_solid_#fff] focus-visible:[outline-offset:3px]",
  innerBlockOpen: "relative w-[66px] h-[66px] !rounded-[50%] bg-[var(--bb-chat-title-bg)] text-[var(--bb-chat-title-text)] border-none cursor-pointer flex items-center justify-center [outline:none] box-border focus-visible:[outline:2px_solid_#fff] focus-visible:[outline-offset:3px]",
  iconWrap: "relative flex-1 w-full h-full",
  iconItem: "absolute top-0 left-0 flex items-center justify-center w-full h-full [transition:opacity_0.6s_ease-out] opacity-100",
  closeItem: "absolute top-0 left-0 flex items-center justify-center w-full h-full [transition:opacity_0.6s_ease-out] opacity-0",
  // mobile size additions (closed FAB only, lives in the anchor)
  mBlock: " max-md:w-[48px] max-md:h-[48px]",
  mMask: " max-md:w-[60px] max-md:h-[60px]",
  panelItem: "block text-[#333] overflow-hidden no-underline px-4 py-2",
  panelIcon: "float-left mr-[5px]",
  panelLabel: "h-10 leading-10 text-[#333] m-0 text-[1.1em] font-[Arial,sans-serif]",
};

const BLOCK = ["width","height","borderRadius","overflow","boxSizing","backgroundColor"];
const INNERBLOCK = ["position","width","height","borderRadius","backgroundColor","color","borderTopStyle","borderTopWidth","cursor","display","alignItems","justifyContent","boxSizing"];
const MASK = ["position","top","left","width","height","minWidth","borderRadius","backgroundColor","opacity","pointerEvents"];
const CONTAINER = ["position","display","transform"];
const ICONWRAP = ["position","flexGrow","width","height"];
const ITEM = ["position","top","left","display","alignItems","justifyContent","width","height","transitionProperty","transitionDuration","opacity"];
const TITLE = ["display","backgroundColor","color","fontSize","fontFamily","paddingTop","paddingLeft","borderRadius","whiteSpace","position","bottom","right"];
const FLOAT = ["position","direction","fontFamily","display","flexDirection","alignItems"];
const PITEM = ["display","color","overflow","textDecorationLine","paddingTop","paddingLeft"];
const PICON = ["cssFloat","marginRight"];
const PLABEL = ["height","lineHeight","color","marginTop","fontSize","fontFamily"];

async function snap(page, s, mobile) {
  return page.evaluate(({ s, mobile, BLOCK, INNERBLOCK, MASK, CONTAINER, ICONWRAP, ITEM, TITLE, FLOAT, PITEM, PICON, PLABEL }) => {
    document.querySelectorAll(".__chatprobe").forEach(n => n.remove());
    const theme = document.querySelector(".bb-theme") || document.body;
    const read = (el, ks) => { if (!el) return { __missing: true }; const cs = getComputedStyle(el); const o = {}; for (const k of ks) o[k] = cs[k]; return o; };
    const div = (cls) => { const d = document.createElement("div"); d.className = cls; return d; };

    // closed FAB (in a .bb-floating-chat-anchor host so mobile-size descendant rules apply)
    const anchor = div("__chatprobe bb-floating-chat-anchor");
    const float = div(s.float);
    const title = div(s.title); title.textContent = "Bạn cần hỗ trợ?";
    const container = div(s.container + (mobile && s.mBlock !== undefined ? "" : ""));
    const mask = div(s.mask + (s.mMask || ""));
    const block = div(s.block + (s.mBlock || ""));
    const innerBlock = document.createElement("button"); innerBlock.className = s.innerBlock + (s.mBlock || "");
    const iconWrap = div(s.iconWrap);
    const iconItem = div(s.iconItem);
    const closeItem = div(s.closeItem);
    iconWrap.appendChild(iconItem); iconWrap.appendChild(closeItem);
    innerBlock.appendChild(iconWrap); block.appendChild(innerBlock);
    container.appendChild(mask); container.appendChild(block);
    float.appendChild(title); float.appendChild(container);
    anchor.appendChild(float); theme.appendChild(anchor);

    // open FAB (NOT in anchor → no mobile size; bottom class on inner-block button)
    const oWrap = div("__chatprobe"); oWrap.style.position = "fixed"; oWrap.style.left = "-9999px";
    const oContainer = div(s.container);
    const oMask = div(s.mask);
    const oBlock = div(s.block);
    const oInner = document.createElement("button"); oInner.className = s.innerBlockOpen;
    const oIconWrap = div(s.iconWrap);
    const oIconItem = div(s.iconItem + (s.openHideIcon || ""));
    const oClose = div(s.closeItem + (s.openShowClose || ""));
    oIconWrap.appendChild(oIconItem); oIconWrap.appendChild(oClose);
    oInner.appendChild(oIconWrap); oBlock.appendChild(oInner);
    oContainer.appendChild(oMask); oContainer.appendChild(oBlock);
    oWrap.appendChild(oContainer); theme.appendChild(oWrap);

    // panel item
    const pWrap = div("__chatprobe"); pWrap.style.position = "fixed"; pWrap.style.left = "-9999px"; pWrap.style.width = "300px"; pWrap.style.background = "#fff";
    const pItem = document.createElement("a"); pItem.className = s.panelItem;
    const pIcon = div(s.panelIcon); const pSvg = document.createElementNS("http://www.w3.org/2000/svg","svg"); pIcon.appendChild(pSvg);
    const pLabel = div(s.panelLabel); pLabel.innerHTML = "Hotline: <strong>123</strong>";
    pItem.appendChild(pIcon); pItem.appendChild(pLabel); pWrap.appendChild(pItem); theme.appendChild(pWrap);

    return {
      float: read(float, FLOAT),
      title: read(title, TITLE),
      container: read(container, CONTAINER),
      mask: read(mask, MASK),
      block: read(block, BLOCK),
      innerBlock: read(innerBlock, INNERBLOCK),
      iconWrap: read(iconWrap, ICONWRAP),
      iconItem: read(iconItem, ITEM),
      closeItem: read(closeItem, ITEM),
      openInner: read(oInner, INNERBLOCK),
      openContainer: read(oContainer, CONTAINER),
      openIconItem: read(oIconItem, ITEM),
      openClose: read(oClose, ITEM),
      panelItem: read(pItem, PITEM),
      panelIcon: read(pIcon, PICON),
      panelLabel: read(pLabel, PLABEL),
    };
  }, { s, mobile, BLOCK, INNERBLOCK, MASK, CONTAINER, ICONWRAP, ITEM, TITLE, FLOAT, PITEM, PICON, PLABEL });
}

async function capture(out) {
  const s = VARIANT === "old" ? OLD : NEW;
  // open-state extras for NEW (icon hidden, close shown+rotate); OLD gets them from CSS
  if (VARIANT === "new") { s.openHideIcon = " hidden"; s.openShowClose = " opacity-100 [animation:socialRotate_0.4s]"; }
  else { s.openHideIcon = ""; s.openShowClose = ""; s.mBlock = ""; s.mMask = ""; }
  const browser = await chromium.launch();
  const data = {};
  for (const [label, w] of [["desktop", 1280], ["mobile", 390]]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setViewportSize({ width: w, height: 900 });
    await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("body", { timeout: 30000 });
    await page.waitForTimeout(200);
    data[label] = await snap(page, s, label === "mobile");
    process.stdout.write(`captured ${VARIANT} ${label}@${w}\n`);
    await ctx.close();
  }
  fs.writeFileSync(out, JSON.stringify(data, null, 2));
  await browser.close();
  console.log("wrote", out);
}

function diff(oldF, newF) {
  const a = JSON.parse(fs.readFileSync(oldF, "utf8"));
  const b = JSON.parse(fs.readFileSync(newF, "utf8"));
  let mism = 0;
  for (const bucket of Object.keys(a)) for (const grp of Object.keys(a[bucket])) {
    const av = a[bucket][grp], bv = b[bucket]?.[grp];
    if (!av || !bv) { mism++; console.log(`[${bucket}] ${grp}: missing OLD=${!!av} NEW=${!!bv}`); continue; }
    for (const p of Object.keys(av)) if (av[p] !== bv[p]) { mism++; console.log(`[${bucket}] ${grp}.${p}: OLD="${av[p]}" NEW="${bv[p]}"`); }
  }
  console.log(mism === 0 ? "\n✅ 0 mismatches" : `\n❌ ${mism} mismatches`);
}

const [, , mode, a, b] = process.argv;
if (mode === "capture") await capture(a);
else if (mode === "diff") diff(a, b);
else console.log("usage: capture <out> | diff <old> <new>");
