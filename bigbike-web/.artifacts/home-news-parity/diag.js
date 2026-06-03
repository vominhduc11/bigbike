const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  for (const vw of [390, 767]) {
    const p = await b.newPage({ viewport: { width: vw, height: 2200 } });
    await p.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
    await p.waitForSelector(".bb-home-news-parity");
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const sec = document.querySelector(".bb-home-news-parity");
      const row = sec.children[0].children[1].children[0];
      return Array.from(row.children).map((col) => {
        const item = col.children[0];
        const inside = item.children[1].children[item.children[1].children.length - 1];
        const title = inside.children[0];
        const exc = inside.children[1];
        const cs = exc ? getComputedStyle(exc) : null;
        return {
          colH: Math.round(col.getBoundingClientRect().height),
          titleH: Math.round(title.getBoundingClientRect().height),
          excH: exc ? Math.round(exc.getBoundingClientRect().height) : null,
          excScroll: exc ? exc.scrollHeight : null,
          excDisplay: cs ? cs.display : null,
          excLineClamp: cs ? cs.webkitLineClamp : null,
          excText: exc ? exc.textContent.slice(0, 60) : null,
        };
      });
    });
    console.log("vw", vw, JSON.stringify(r, null, 1));
    await p.close();
  }
  await b.close();
})();
