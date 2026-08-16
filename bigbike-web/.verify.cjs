const { chromium } = require("playwright");
const OUT = "/tmp/claude-0/-root-myproject-bigbike/4ab82871-2fb9-45b7-acf6-815a36652b00/scratchpad/shots";
const BASE = "http://127.0.0.1:3100";

const read = (page) => page.evaluate(() => {
  const f = document.querySelector("aside [data-price-filter='true']");
  return {
    inputs: [...f.querySelectorAll("input")].map((i) => i.value),
    thumbs: [...f.querySelectorAll("[role='slider']")].map((t) => t.getAttribute("aria-valuenow")),
    active: f.getAttribute("data-price-filter-active"),
    url: location.search,
  };
});
const show = (tag, v) => console.log(`${tag.padEnd(34)} boxes=${JSON.stringify(v.inputs)} handles=${JSON.stringify(v.thumbs)} url=${v.url || "(none)"}`);

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();

  // ---- 1. the reported typing bug ----
  console.log("=== TEST 1: gõ 200 → dừng nghĩ → gõ tiếp 0000 (muốn 2.000.000) ===");
  await page.goto(BASE + "/sp/", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  const minInput = page.locator("aside [data-price-input='min']");
  await minInput.click();
  await minInput.press("Control+a");
  await minInput.press("Backspace");
  await minInput.pressSequentially("200", { delay: 90 });
  await page.waitForTimeout(1500);
  show("sau khi gõ 200 + dừng 1,5 giây", await read(page));
  await minInput.pressSequentially("0000", { delay: 90 });
  show("sau khi gõ tiếp 0000", await read(page));
  await minInput.press("Enter");
  await page.waitForTimeout(2500);
  show("sau khi bấm Enter", await read(page));
  await page.locator("aside [data-price-filter='true']").screenshot({ path: `${OUT}/verify-typing.png` });

  // ---- 2. Escape cancels ----
  console.log("\n=== TEST 2: gõ bậy rồi bấm Esc ===");
  await minInput.click();
  await minInput.press("Control+a");
  await minInput.pressSequentially("777", { delay: 60 });
  await minInput.press("Escape");
  await page.waitForTimeout(600);
  show("sau khi bấm Esc", await read(page));

  // ---- 3. chip removal resyncs the boxes ----
  console.log("\n=== TEST 3: xoá lọc giá bằng thẻ trên lưới sản phẩm ===");
  await page.goto(BASE + "/sp/?min_price=1000000&max_price=4000000", { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("networkidle", { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  show("trước khi bấm ✕", await read(page));
  await page.getByRole("button", { name: /^Bỏ bộ lọc/ }).first().click();
  await page.waitForTimeout(2500);
  show("sau khi bấm ✕", await read(page));
  await page.locator("aside [data-price-filter='true']").screenshot({ path: `${OUT}/verify-chip.png` });

  // ---- 4. slider still works ----
  console.log("\n=== TEST 4: kéo thanh trượt ===");
  const track = await page.locator("aside [data-price-filter='true'] span[data-orientation='horizontal']").first().boundingBox();
  const th = await page.locator("aside [data-price-filter='true'] [role='slider']").nth(1).boundingBox();
  await page.mouse.move(th.x + th.width / 2, th.y + th.height / 2);
  await page.mouse.down();
  await page.mouse.move(track.x + track.width * 0.4, th.y + th.height / 2, { steps: 15 });
  await page.mouse.up();
  await page.waitForTimeout(2500);
  show("sau khi kéo tay cầm phải", await read(page));

  await ctx.close();
  await b.close();
})();
