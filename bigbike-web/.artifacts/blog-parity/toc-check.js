const { chromium } = require("playwright");
(async () => {
  const browser = await chromium.launch();
  for (const [label, base] of [["OLD :3000", "http://localhost:3000"], ["NEW :3001", "http://localhost:3001"]]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 1600 } });
    await page.goto(`${base}/tin-tuc/tai-nghe-bluetooth-5-3-la-gi/`, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("#table-of-content", { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const r = await page.evaluate(() => {
      const toc = document.getElementById("table-of-content");
      if (!toc) return { missing: true };
      const cs = getComputedStyle(toc);
      return { display: cs.display, childCount: toc.childElementCount, hasTitle: !!toc.querySelector(".toc-title"), listItems: toc.querySelectorAll(".table-of-content-list li").length, toggleText: (toc.querySelector(".btn-toggle") || {}).textContent || null, innerLen: toc.innerHTML.length };
    });
    console.log(label, JSON.stringify(r));
    await page.close();
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
